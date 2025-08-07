"use client"

import { useEffect, useState } from "react"
import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import StreamView from "../components/StreamView"
import axios from "axios"

export default function StreamVotingUI() {
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    const getCurrentUser = async () => {
      if (session?.user?.email) {
        try {
          const res = await axios.get("/api/user/me");
          if (res.data.user) {
            setCreatorId(res.data.user.id);
          }
        } catch (error) {
          console.error("Failed to fetch current user:", error);
          
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            // User not registered, redirect to login
            signIn('google', { callbackUrl: '/dashboard' });
            return;
          }
          
          // Fallback: use email as creatorId
          setCreatorId(session.user.email);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    if (status === "unauthenticated") {
      // Not logged in at all, redirect to login
      signIn('google', { callbackUrl: '/dashboard' });
      return;
    }

    if (status === "authenticated") {
      getCurrentUser();
    }
  }, [session?.user?.email, status]);

  // Show loading while checking authentication
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  // This shouldn't render if redirecting, but just in case
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-lg">Redirecting to login...</div>
      </div>
    );
  }

  if (!creatorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <div className="text-white text-lg">Unable to load user data</div>
      </div>
    );
  }

  return (
    <StreamView 
      creatorId={creatorId}
      isCreatorPage={false} 
    />
  );
}