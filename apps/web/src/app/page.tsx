import { ChatWidget } from "../components/chat/ChatWidget.js";

/**
 * Demo page — shows the ChatWidget embedded on a mock website.
 * In production, the widget is embedded via the standalone
 * script tag (Phase 8). This page is for development and demo.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center text-white space-y-6">
        <div className="space-y-2">
          <p className="text-brand-100 text-sm font-medium uppercase tracking-wider">
            AppViewX
          </p>
          <h1 className="text-4xl font-bold">Machine Identity Management</h1>
          <p className="text-slate-400 text-lg">
            Automate certificate lifecycle management and PKI operations at
            enterprise scale.
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium transition-colors">
            Get Started
          </button>
          <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors">
            Learn More
          </button>
        </div>

        <p className="text-slate-500 text-sm">
          Click the chat button in the bottom-right to talk to our AI assistant
        </p>
      </div>

      {/* The ChatWidget — this is what gets embedded on customer sites */}
      <ChatWidget
        websiteId="appviewx"
        primaryColor="#185fa5"
        botName="AVX Assistant"
      />
    </main>
  );
}
