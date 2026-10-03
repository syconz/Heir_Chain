import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || "The application encountered an unexpected error.",
    };
  }

  componentDidCatch(error, info) {
    console.error("HeirChain UI error", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-dark-900 text-gray-100 flex items-center justify-center p-6">
        <div className="glass max-w-lg p-8 text-center">
          <p className="text-3xl mb-4">⚠️</p>
          <h1 className="text-xl font-semibold mb-2">HeirChain could not load</h1>
          <p className="text-gray-500 text-sm mb-6">
            Refresh the page and try again. If the problem continues, check your wallet connection and network.
          </p>
          <p className="text-xs text-gray-600 break-words mb-6">{this.state.message}</p>
          <button className="btn-primary" onClick={() => window.location.reload()}>
            Refresh application
          </button>
        </div>
      </main>
    );
  }
}
