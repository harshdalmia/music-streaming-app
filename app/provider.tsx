"use client";

import { SessionProvider } from "next-auth/react";
import { JSX, ReactNode } from "react";

interface ProvidersProps {
  children: ReactNode;
}
export function Providers({ children }: ProvidersProps): JSX.Element {
    return (
    <SessionProvider>
        {children}
    </SessionProvider>
    );
}
