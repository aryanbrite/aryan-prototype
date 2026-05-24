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
        setStatus({ text: `Success! Bot ID: ${data.bot_id}`, error: false });
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Gemini Meeting Bot
        </h1>
        <p className="mb-6 text-center text-gray-600">
          Join meetings with our AI-powered bot that captures audio and provides real-time assistance
        </p>

        <form onSubmit={handleJoin} className="space-y-4" role="form">
          <div>
            <label htmlId="meetingUrl" className="mb-1 block text-sm font-medium text-gray-700">
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
            className="w-full rounded-md bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors duration-200"
          >
            {loading ? (
              <>
                Joining...
                <span className="ml-2 animate-spin h-4 w-4 border-2 border-blue-200 border-t-blue-600 rounded-full"></span>
              </>
            ) : (
              'Join Meeting'
            )}
          </button>

          {/* Loading skeleton for better UX */}
          {loading && (
            <div className="mt-2 h-2 w-32 bg-gray-200 rounded-full animate-pulse">
              <div className="h-2 w-2/3 bg-blue-600 rounded-full"></div>
            </div>
          )}
        </form>

        {status.text && (
          <div
            role="alert"
            className={`mt-4 rounded-md p-3 text-sm flex items-center ${
              status.error
                ? 'bg-red-50 text-red-700 border-l-4 border-red-500'
                : 'bg-green-50 text-green-700 border-l-4 border-green-500'
            }`}
          >
            {status.error && (
              <svg className="flex-shrink-0 w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
              </svg>
            )}
            {!status.error && (
              <svg className="flex-shrink-0 w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
            <span className="ml-2">{status.text}</span>
          </div>
        )}

        {/* Accessibility improvements */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Supported platforms:{''}
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