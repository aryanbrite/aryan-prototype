"use client";

import { useState, type FormEvent } from "react";

type StatusState = {
  text: string;
  error: boolean;
};

export default function Home() {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [status, setStatus] = useState<StatusState>({
    text: "",
    error: false,
  });
  const [loading, setLoading] = useState(false);

  const handleJoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoading(true);
    setStatus({
      text: "Requesting bot to join...",
      error: false,
    });

    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        "http://localhost:8000";

      const response = await fetch(`${backendUrl}/api/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meeting_url: meetingUrl,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        setStatus({
          text: `Success! Bot ID: ${data.bot_id}`,
          error: false,
        });
      } else {
        setStatus({
          text: `Error: ${data.message}`,
          error: true,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      setStatus({
        text: `Connection Error: ${message}`,
        error: true,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main>
        <p>
          ----------------------------------------------------------------
        </p>

        <h1>.cucumbu</h1>

        <p>
          This is an interactive demo of the cucumbu API :)
        </p>

        <form onSubmit={handleJoin}>
          <input
            type="url"
            required
            placeholder="https://meet.google.com/xxx-yyy-zzz"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Joining..." : "Join Meeting"}
          </button>
        </form>

        {status.text && (
          <p
            className={
              status.error ? "status error" : "status success"
            }
          >
            {status.text}
          </p>
        )}

        <p>
          ----------------------------------------------------------------
        </p>
      </main>

      <p id="love">made with love ❤️</p>
    </>
  );
}