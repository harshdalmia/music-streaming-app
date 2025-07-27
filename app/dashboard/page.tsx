"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
//@ts-ignore
import StreamView from "../components/StreamView"
import axios from "axios"



export default function StreamVotingUI() {
  const [creatorId, setCreatorId] = useState<string | null>(null)
  const session = useSession()

  useEffect(() => {
    const getCurrentUser = async () => {
      if (session.data?.user?.email) {
        try {
          const res = await axios.get("/api/user/me", {
            withCredentials: true
          });
          if (res.data.user) {
            setCreatorId(res.data.user.id);
          }
        } catch (error) {
          console.error("Failed to fetch current user:", error);
        }
      }
    };

    getCurrentUser();
  }, [session.data?.user?.email]);

  if (!creatorId) {
    return <div>Loading...</div>
  }

  return (
    <StreamView creatorId={creatorId}
    isCreatorPage={false} />
  )
}