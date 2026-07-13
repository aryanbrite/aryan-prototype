import Link from 'next/link';

export default function Privacy() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Privacy Policy
        </h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Information We Collect</h2>
            <p className="text-gray-600">
              We collect minimal personal data necessary for the Meeting Bot API to function:
              <br className="mb-1" />
              • Meeting URLs provided by users<br className="mb-1" />
              • Temporary audio processing data<br className="mb-1" />
              • Usage analytics (anonymized)
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">How We Use Your Data</h2>
            <p className="text-gray-600">
              Your data is used solely for:
              <br className="mb-1" />
              • Processing meeting bot requests<br className="mb-1" />
              • Providing real-time AI assistance<br className="mb-1" />
              • Improving service reliability
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Data Sharing</h2>
            <p className="text-gray-600">
              We do not sell or share your personal data with third parties.
              Audio data is processed temporarily with Google Gemini and is not stored.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Your Rights</h2>
            <p className="text-gray-600">
              You have the right to:
              <br className="mb-1" />
              • Request deletion of your data<br className="mb-1" />
              • Opt out of data collection<br className="mb-1" />
              • Access any data we hold about you
            </p>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}