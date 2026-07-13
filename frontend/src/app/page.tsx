'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

type StatusState = {
  text: string;
  error: boolean;
};

export default function Home() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [status, setStatus] = useState<StatusState>({ text: '', error: false });
  const [loading, setLoading] = useState(false);
  const [botId, setBotId] = useState<string | null>(null);
  const [activeMeeting, setActiveMeeting] = useState<boolean>(false);
  const [botStatus, setBotStatus] = useState<any>(null);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ text: 'Requesting bot to join...', error: false });

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${backendUrl}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_url: meetingUrl }),
      });

      const data = await response.json();
      if (data.status === 'success') {
        setBotId(data.bot_id);
        setActiveMeeting(true);
        setStatus({ text: `Success! Bot ID: ${data.bot_id}`, error: false });

        // Start polling for bot status
        startStatusPolling(data.bot_id);
      } else {
        setStatus({ text: `Error: ${data.message}`, error: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ text: `Connection Error: ${message}`, error: true });
    } finally {
      setLoading(false);
    }
  };

  // Function to poll bot status
  const startStatusPolling = (botId: string) => {
    const interval = setInterval(async () => {
      try {
        const backendUrl =
          process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backendUrl}/api/bot-status/${botId}`);
        const data = await response.json();

        if (data.status === 'success') {
          setBotStatus(data.bot);
        } else {
          // Bot might have ended or expired
          clearInterval(interval);
          setActiveMeeting(false);
          setStatus({ text: 'Meeting ended or bot disconnected', error: false });
        }
      } catch (error) {
        console.error('Error fetching bot status:', error);
        // Continue polling despite errors
      }
    }, 5000); // Poll every 5 seconds

    // Clean up interval on unmount
    return () => clearInterval(interval);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Cucumbu Meeting Bot
        </h1>
        <p className="mb-6 text-center text-gray-600">
          Your AI-powered workspace assistant for meetings
        </p>

        {!activeMeeting && !botId ? (
          <form onSubmit={handleJoin} className="space-y-6" role="form">
            <div>
              <label htmlFor="meetingUrl" className="mb-1 block text-sm font-medium text-gray-700">
                Meeting URL
              </label>
              <input
                id="meetingUrl"
                type="url"
                required
                placeholder="https://meet.google.com/abc-defg-hij"
                aria-label="Meeting URL"
                aria-required="true"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={meetingUrl}
                onChange={(event) => setMeetingUrl(event.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200"
            >
              {loading ? (
                <>
                  Starting Cucumbu...
                  <span className="ml-2 animate-spin h-4 w-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full"></span>
                </>
              ) : (
                'Start Cucumbu Meeting Bot'
              )}
            </button>

            {/* Loading skeleton for better UX */}
            {loading && (
              <div className="mt-2 h-2 w-32 bg-gray-200 rounded-full animate-pulse">
                <div className="h-2 w-2/3 bg-indigo-600 rounded-full"></div>
              </div>
            )}
          </form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-3">
                <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
                  <svg className="h-6 w-6 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    Cucumbu is active!
                  </h2>
                  <p className="text-sm text-gray-500">
                    Your workspace assistant is in the meeting
                  </p>
                </div>
              </div>
            </div>

            {botStatus && (
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-md">
                <h3 className="font-semibold text-indigo-800 mb-2">Meeting Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Meeting URL:</span>
                    <span className="font-medium text-gray-800 break-all">{botStatus.meeting_url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Joined at:</span>
                    <span className="font-medium text-gray-800">
                      {new Date(botStatus.joined_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Duration:</span>
                    <span className="font-medium text-gray-800">
                      {botStatus.duration.hours}h {botStatus.duration.minutes}m {botStatus.duration.seconds}s
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800 mb-2">What Cucumbu Can Do</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-3 w-3 bg-indigo-600 rounded-full mt-0.5"></div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Listen and understand:</span> Cucumbu captures meeting audio and processes it in real-time
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-3 w-3 bg-indigo-600 rounded-full mt-0.5"></div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Participate naturally:</span> Speaks like a human colleague with appropriate interjections and reactions
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-3 w-3 bg-indigo-600 rounded-full mt-0.5"></div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Meeting insights:</span> Can provide summaries and action items when asked
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-3 w-3 bg-indigo-600 rounded-full mt-0.5"></div>
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Privacy focused:</span> Audio is processed temporarily and not stored
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-gray-200">
              <button
                onClick={() => {
                  setBotId(null);
                  setActiveMeeting(false);
                  setBotStatus(null);
                  setMeetingUrl('');
                }}
                className="w-full rounded-md bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors duration-200"
              >
                End Meeting &amp; Remove Bot
              </button>
            </div>
          </div>
        )}

        {/* Accessibility improvements */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Supported platforms:{"" }
            <span className="font-medium">
              Google Meet, Zoom, Microsoft Teams
            </span>
          </p>
          <p className="mt-1">
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>{' '}
            |{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}