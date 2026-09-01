"use client";

import React, { ReactNode } from "react";
import toast from "react-hot-toast";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Error caught by boundary:", error, errorInfo);

        toast.error((t) => (
            <div className="flex flex-col gap-2">
                <p className="font-semibold">Something went wrong</p>
                <p className="text-sm opacity-90">{error.message}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-2 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm"
                >
                    Reload Page
                </button>
            </div>
        ), {
            duration: 0,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex items-center justify-center min-h-screen bg-slate-50">
                    <div className="bg-white border-2 border-red-500 rounded-lg p-8 max-w-md">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">
                            Something Went Wrong
                        </h1>
                        <p className="text-slate-600 mb-6">
                            {this.state.error?.message || "An unexpected error occurred"}
                        </p>
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg"
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}