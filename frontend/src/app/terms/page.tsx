import Link from 'next/link';

export default function Terms() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        {/* Logo Section */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center">
            <span className="font-mono text-[32px] font-[900] text-black tracking-[-1px] leading-none">
              .cucumbu
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            © 2026 Cucumbu Inc. | Work with agents, your way
          </p>
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Terms of Service
        </h1>

        <div className="space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Acceptance of Terms</h2>
            <p className="text-gray-600">
              By accessing or using the Cucumbu Meeting Bot service, you agree to be bound by these
              Terms of Service and all applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Service Description</h2>
            <p className="text-gray-600">
              Cucumbu provides an AI-powered workspace assistant that can join Google Meet, Zoom,
              and Microsoft Teams meetings to provide real-time assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">User Responsibilities</h2>
            <p className="text-gray-600">
              You agree to:
              <br className="mb-1" />
              • Use the service only for lawful purposes<br className="mb-1" />
              • Not attempt to reverse engineer or decompile any part of the service<br className="mb-1" />
              • Respect the privacy of other meeting participants<br className="mb-1" />
              • Comply with all applicable meeting platform terms of service
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Disclaimer of Warranties</h2>
            <p className="text-gray-600">
              The service is provided "as is" and "as available" without warranties of any kind,
              either express or implied, including but not limited to implied warranties of
              merchantability, fitness for a particular purpose, or non-infringement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">Limitation of Liability</h2>
            <p className="text-gray-600">
              In no event shall Cucumbu Inc., its directors, employees, or agents be liable for
              any indirect, incidental, special, consequential, or punitive damages, or any loss
              of profits or revenues, whether incurred directly or indirectly, or any loss of
              data, use, goodwill, or other intangible losses.
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