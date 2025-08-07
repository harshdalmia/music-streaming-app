"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, Play, Users, Plus, Share } from "lucide-react"
import { YouTubeEmbed } from "@next/third-parties/google"
import axios from "axios"
import { Appbar } from "./Appbar"

interface Video {
  id: string
  type: string
  url: string
  extractedId: string
  bigImg: string
  smallImg: string
  userId: string
  title: string
  active: boolean
  upvotes: number
  haveUpvoted: boolean
}

export default function StreamView({
    creatorId,
    isCreatorPage = false
}:{
    creatorId?: string | null
    isCreatorPage?: boolean
}) {
  const { data: session } = useSession()  // Add this line
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [queue, setQueue] = useState<Video[]>([])
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  

  async function refreshStreams() {
    try {
      console.log("Fetching streams for creatorId:", creatorId);
      const res = await axios.get(`/api/streams/?creatorId=${creatorId}`);
      if (res.data.streams) {
        setQueue(res.data.streams);
        
        const activeStream = res.data.streams.find((stream: Video) => stream.active);
        if (activeStream) {
          setCurrentVideo(activeStream);
        }
      }
    } catch (error) {
      console.error("Failed to fetch streams:", error);
      
      if (axios.isAxiosError(error)) {
        console.error("Response data:", error.response?.data);
        console.error("Response status:", error.response?.status);
      }
    }
  }

  useEffect(() => {
    refreshStreams();
    const interval = setInterval(() => {
      refreshStreams();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  function extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) return match[1]
    }
    return null
  }

  const handleShare = async () => {
    const shareData = {
      title: "🎵 Stream Song Voting",
      text: "Vote for the next song on the stream! Submit your favorites and help decide what plays next.",
      url: `${window.location.origin}/creator/${creatorId}`,  // Fixed: use origin instead of hostname
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareData.url)
        setShareMessage("Link copied to clipboard!")
        setTimeout(() => setShareMessage(""), 3000)
      }
    } catch (error) {
      setShareMessage("Share this URL: " + shareData.url)
      setTimeout(() => setShareMessage(""), 5000)
    }
  }

  const handleUrlChange = (url: string) => {
    setNewVideoUrl(url)
    const videoId = extractYouTubeId(url)
    setPreviewVideo(videoId)
  }

  const handleSubmitVideo = async () => {
    if (!newVideoUrl || !previewVideo) return

    setIsSubmitting(true)

    try {
      await axios.post("/api/streams", {
        url: newVideoUrl,
        type: "Youtube"
      });
      
      // Refresh streams after adding
      await refreshStreams();
      
      setNewVideoUrl("")
      setPreviewVideo(null)
    } catch (error) {
      console.error("Failed to submit video:", error);
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (videoId: string, increment: number) => {
    try {
        if (increment > 0) {
            await axios.post("/api/streams/upvotes", {
                streamId: videoId
            });
        } else {
            await axios.post("/api/streams/downvotes", {
                streamId: videoId
            });
        }
        
        // Update local state optimistically
        setQueue((prev) =>
            prev.map((video) => 
                video.id === videoId 
                    ? { 
                        ...video, 
                        upvotes: Math.max(0, video.upvotes + increment), 
                        haveUpvoted: increment > 0 // Remove session check since anonymous users can vote
                    } 
                    : video
            ).sort((a, b) => b.upvotes - a.upvotes)
        );

        // Refresh to get accurate data
        await refreshStreams();
    } catch (error) {
        console.error("Failed to vote:", error);
        if (axios.isAxiosError(error) && error.response?.data?.error === "Already upvoted") {
            alert("You have already voted for this song!");
        }
    }
  }

  const handlePlayNext = async () => {
    if (queue.length === 0) return

    // Mark current video as inactive
    if (currentVideo) {
      try {
        await axios.patch(`/api/streams/${currentVideo.id}`, {
          active: false
        });
        console.log(`Marked video ${currentVideo.id} as inactive`);
      } catch (error) {
        console.error("Failed to mark video as inactive:", error);
      }
    }

    const nextVideo = queue[0]
    setCurrentVideo(nextVideo)
    setQueue((prev) => prev.slice(1))
    
    // Refresh the streams list
    await refreshStreams();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Appbar />
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header - Only show share button on dashboard, not creator page */}
          <div className="text-center space-y-2 relative">
            <div className="flex items-center justify-center gap-4">
              <h1 className="text-4xl font-bold text-white">🎵 Stream Song Voting</h1>
              {!isCreatorPage && (
                <Button
                  onClick={handleShare}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-purple-500/30 text-white hover:bg-white/20"
                >
                  <Share className="w-4 h-4 mr-1" />
                  Share
                </Button>
              )}
            </div>
            <p className="text-purple-200">Vote for the next song or submit your own!</p>
            {shareMessage && (
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-10">
                {shareMessage}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Current Video */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="bg-black/20 border-purple-500/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-red-500" />
                    Now Playing
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentVideo ? (
                    <>
                      {/* Conditional rendering based on isCreatorPage */}
                      {isCreatorPage ? (
                        // Show thumbnail for creator page (shared links)
                        <div className="aspect-video rounded-lg overflow-hidden bg-black/40 relative">
                          <img 
                            src={currentVideo.bigImg || `https://img.youtube.com/vi/${currentVideo.extractedId}/maxresdefault.jpg`}
                            alt={currentVideo.title}
                            className="w-full h-full object-cover"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-red-600 rounded-full p-4 hover:bg-red-700 transition-colors pointer-events-none">
                              <Play className="w-8 h-8 text-white fill-white" />
                            </div>
                          </div>
                          {/* Disabled overlay to prevent clicking */}
                          <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-4">
                            <div className="bg-black/70 text-white px-3 py-1 rounded text-sm">
                              Video preview - controlled by stream creator
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Show auto-playing video for dashboard
                        <div className="aspect-video rounded-lg overflow-hidden">
                          <YouTubeEmbed videoid={currentVideo.extractedId} height={400} params="autoplay=1&mute=1" />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-white">
                        <div>
                          <h3 className="font-semibold">{currentVideo.title}</h3>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-video rounded-lg bg-black/40 flex items-center justify-center">
                      <p className="text-white">No video currently playing</p>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
                    <div className="flex items-center gap-2 text-purple-200 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{queue.length} songs in queue</span>
                    </div>
                    {/* Only show Play Next button on dashboard, not creator page */}
                    {!isCreatorPage && (
                      <Button
                        onClick={handlePlayNext}
                        disabled={queue.length === 0}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                        size="sm"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Play Next
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Submit New Video */}
              <Card className="bg-black/20 border-purple-500/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Plus className="w-5 h-5 text-green-500" />
                    Submit a Song
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste YouTube URL here..."
                      value={newVideoUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="bg-white/10 border-purple-500/30 text-white placeholder:text-purple-300"
                    />
                    <Button
                      onClick={handleSubmitVideo}
                      disabled={!previewVideo || isSubmitting}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      {isSubmitting ? "Adding..." : "Add to Queue"}
                    </Button>
                  </div>

                  {previewVideo && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-black/40">
                      {isCreatorPage ? (
                        // Show thumbnail preview for creator page
                        <img 
                          src={`https://img.youtube.com/vi/${previewVideo}/mqdefault.jpg`}  // Fixed: complete the URL
                          alt="Video preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        // Show YouTube embed for dashboard
                        <YouTubeEmbed videoid={previewVideo} height={200} params="controls=1" />
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Queue */}
            <div className="space-y-4">
              <Card className="bg-black/20 border-purple-500/30 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Queue ({queue.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
                  {queue.map((video, index) => (
                    <div
                      key={video.id}
                      className="bg-white/5 rounded-lg p-3 border border-purple-500/20 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex gap-3">
                        <div className="relative">
                          <img
                            src={video.smallImg || `https://img.youtube.com/vi/${video.extractedId}/mqdefault.jpg`}
                            alt={video.title}
                            className="w-16 h-12 rounded object-cover"
                          />
                          <Badge variant="secondary" className="absolute -top-1 -left-1 text-xs bg-purple-600 text-white">
                            #{index + 1}
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-white text-sm font-medium truncate">{video.title}</h4>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          {!video.haveUpvoted ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleVote(video.id, 1)}
                              className="h-6 w-6 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </Button>
                          ) : (
                            <div className="h-6 w-6 flex items-center justify-center">
                              <ChevronUp className="w-4 h-4 text-green-600" />
                            </div>
                          )}
                          <span className="text-white text-sm font-bold min-w-[2ch] text-center">{video.upvotes}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleVote(video.id, -1)}
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                            disabled={video.upvotes === 0}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {queue.length === 0 && (
                    <div className="text-center py-8 text-purple-300">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No songs in queue</p>
                      <p className="text-sm">Be the first to add one!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}