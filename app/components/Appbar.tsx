"use client";
import { signIn, signOut, useSession } from "next-auth/react";

export function Appbar() {
    const session = useSession();
    return <div className="flex justify-between">
        <div className="text-2xl font-bold text-blue-500 flex flex-col justify-center">
            music
        </div>
        {session.data?.user ? (
            <button className="bg-blue-500 hover:bg-blue-700 font-bold py-2 px-4 rounded" onClick={() => signOut()}>
                Log out
            </button>
        ) : (
            <button className="bg-blue-500 hover:bg-blue-700 font-bold py-2 px-4 rounded" onClick={() => signIn()}>
                Sign In
            </button>
        )}
    </div>
}