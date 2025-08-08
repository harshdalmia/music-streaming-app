"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, Play, Users, Plus, Share, X } from "lucide-react"
import IsolatedYouTubePlayer from "./IsolatedYoutubePlayer"
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
  isCurrentlyPlaying?: boolean
}

export default function StreamView({
    creatorId,
    isCreatorPage = false
}:{
    creatorId?: string | null
    isCreatorPage?: boolean
}) {
  const { data: session } = useSession()
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null)
  const [currentVideoTitle, setCurrentVideoTitle] = useState<string>("")
  const [currentVideoImg, setCurrentVideoImg] = useState<string>("")
  const [queue, setQueue] = useState<Video[]>([])
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [playerKey, setPlayerKey] = useState(0)
  const lastCurrentVideoRef = useRef<string | null>(null)
  
  // Stable fetch function with better current video detection
  const fetchQueue = useCallback(async () => {
    if (!creatorId) return
    
    try {
      const response = await fetch(`/api/streams?creatorId=${creatorId}`)
      
      if (response.ok) {
        const data = await response.json()
        const activeStreams = data.streams.filter((stream: Video) => stream.active)
        const sortedStreams = activeStreams.sort((a: Video, b: Video) => b.upvotes - a.upvotes)
        
        // Remove currently playing video from queue display
        const queueWithoutCurrent = currentVideoId 
          ? sortedStreams.filter(stream => stream.extractedId !== currentVideoId)
          : sortedStreams
        
        setQueue(queueWithoutCurrent)
        
        // Check if there's a new current video from the API
        const apiCurrentVideo = data.currentlyPlaying
        
        if (apiCurrentVideo) {
          const newVideoId = apiCurrentVideo.extractedId
          
          // If this is a new video different from what we're currently showing
          if (newVideoId !== lastCurrentVideoRef.current) {
            console.log('New video detected:', newVideoId, 'Previous:', lastCurrentVideoRef.current)
            
            setCurrentVideoId(newVideoId)
            setCurrentVideoTitle(apiCurrentVideo.title)
            setCurrentVideoImg(apiCurrentVideo.bigImg)
            
            // If we're on fan page and video changed, update player
            if (!isCreatorPage && lastCurrentVideoRef.current !== null) {
              setIsVideoPlaying(true)
              setPlayerKey(prev => prev + 1) // Force new player instance
            }
            
            lastCurrentVideoRef.current = newVideoId
            setIsInitialized(true)
          }
        } else if (!isInitialized && sortedStreams.length > 0) {
          // Fallback: if no currentlyPlaying from API, use first in queue
          const firstVideo = sortedStreams[0]
          setCurrentVideoId(firstVideo.extractedId)
          setCurrentVideoTitle(firstVideo.title)
          setCurrentVideoImg(firstVideo.bigImg)
          lastCurrentVideoRef.current = firstVideo.extractedId
          setIsInitialized(true)
          
          // Remove the now-playing video from queue
          setQueue(sortedStreams.slice(1))
        } else if (sortedStreams.length === 0) {
          // No videos in queue
          setCurrentVideoId(null)
          setCurrentVideoTitle("")
          setCurrentVideoImg("")
          setIsVideoPlaying(false)
          lastCurrentVideoRef.current = null
        }
      }
    } catch (error) {
      console.error('Error fetching streams:', error)
    }
  }, [creatorId, isInitialized, isCreatorPage, currentVideoId])

  // Play next function - removes current video and plays next
  const playNext = useCallback(async () => {
    console.log('Playing next video...')
    
    if (queue.length === 0) {
      setCurrentVideoId(null)
      setCurrentVideoTitle("")
      setCurrentVideoImg("")
      setIsVideoPlaying(false)
      lastCurrentVideoRef.current = null
      return
    }

    const nextVideo = queue[0] // Take first from queue
    
    // Mark current video as inactive in database
    if (currentVideoId) {
      // Find current video in original queue to get its ID
      try {
        const response = await fetch(`/api/streams?creatorId=${creatorId}`)
        if (response.ok) {
          const data = await response.json()
          const currentVideo = data.streams.find((s: Video) => s.extractedId === currentVideoId)
          
          if (currentVideo) {
            await fetch(`/api/streams/${currentVideo.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: false }),
            })
          }
        }
      } catch (error) {
        console.error('Error marking current stream as inactive:', error)
      }
    }
    
    // Set new video
    setCurrentVideoId(nextVideo.extractedId)
    setCurrentVideoTitle(nextVideo.title)
    setCurrentVideoImg(nextVideo.bigImg)
    setIsVideoPlaying(true)
    setPlayerKey(prev => prev + 1)
    lastCurrentVideoRef.current = nextVideo.extractedId
    
    // Remove the new current video from queue immediately
    setQueue(prev => prev.filter(video => video.id !== nextVideo.id))
    
    // Update queue after a delay
    setTimeout(() => fetchQueue(), 1000)
  }, [queue, fetchQueue, currentVideoId, creatorId])

  // Handle play video - removes from queue when starting
  const handlePlayVideo = () => {
    setIsVideoPlaying(true)
    setPlayerKey(prev => prev + 1)
    
    // Remove current video from queue display when it starts playing
    if (currentVideoId) {
      setQueue(prev => prev.filter(video => video.extractedId !== currentVideoId))
    }
  }

  // More frequent polling - especially important for fan pages
  useEffect(() => {
    if (creatorId) {
      fetchQueue()
      
      // Different polling frequencies for creator vs fan pages
      const pollInterval = isCreatorPage ? 10000 : 3000 // Fan pages poll more frequently
      
      const interval = setInterval(() => {
        fetchQueue()
      }, pollInterval)
      
      return () => clearInterval(interval)
    }
  }, [creatorId, fetchQueue, isCreatorPage])

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
      url: `${window.location.origin}/creator/${creatorId}`,
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
      await axios.post(`/api/streams?creatorId=${creatorId}`, {
        url: newVideoUrl,
        type: "Youtube",
        creatorId: creatorId
      })
      
      setNewVideoUrl("")
      setPreviewVideo(null)
      alert("Song added to queue successfully!")
      
      // Immediate refresh after adding
      setTimeout(() => fetchQueue(), 500)
    } catch (error) {
      console.error("Failed to submit video:", error)
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        alert(error.response.data.error)
      } else {
        alert("Failed to add video. Please try again.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVote = async (videoId: string, increment: number) => {
    try {
        if (increment > 0) {
            await axios.post("/api/streams/upvotes", {
                streamId: videoId
            })
        } else {
            await axios.post("/api/streams/downvotes", {
                streamId: videoId
            })
        }
        
        // Immediate refresh after voting
        setTimeout(() => fetchQueue(), 500)
    } catch (error) {
        console.error("Failed to vote:", error)
        if (axios.isAxiosError(error) && error.response?.data?.error === "Already upvoted") {
            alert("You have already voted for this song!")
        }
    }
  }

  const removeFromQueue = async (streamId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      if (response.ok) {
        // If we removed the current video, clear it
        const removedVideo = queue.find(v => v.id === streamId)
        if (removedVideo && removedVideo.extractedId === currentVideoId) {
          setCurrentVideoId(null)
          setCurrentVideoTitle("")
          setCurrentVideoImg("")
          setIsVideoPlaying(false)
          lastCurrentVideoRef.current = null
        }
        
        // Remove from local queue immediately
        setQueue(prev => prev.filter(video => video.id !== streamId))
        
        // Refresh after removal
        setTimeout(() => fetchQueue(), 500)
      }
    } catch (error) {
      console.error('Error removing from queue:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Appbar />
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
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
                    {!isCreatorPage && (
                      <Badge variant="secondary" className="ml-2 bg-blue-600">
                        Fan View
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentVideoId ? (
                    <>
                      {isCreatorPage ? (
                        // Creator preview
                        <div className="aspect-video rounded-lg overflow-hidden bg-black/40 relative">
                          <img 
                            src={currentVideoImg || `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`}
                            alt={currentVideoTitle}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-red-600 rounded-full p-4 hover:bg-red-700 transition-colors pointer-events-none">
                              <Play className="w-8 h-8 text-white fill-white" />
                            </div>
                          </div>
                          <div className="absolute inset-0 bg-black/20 flex items-end justify-center pb-4">
                            <div className="bg-black/70 text-white px-3 py-1 rounded text-sm">
                              Video preview - controlled by stream creator
                            </div>
                          </div>
                        </div>
                      ) : (
                        // Fan page with video player
                        <div className="aspect-video rounded-lg overflow-hidden relative">
                          {isVideoPlaying ? (
                            <div key={playerKey} className="w-full h-full">
                              <IsolatedYouTubePlayer 
                                videoId={currentVideoId} 
                                onVideoEnd={playNext} 
                              />
                            </div>
                          ) : (
                            <div className="relative w-full h-full bg-black">
                              <img 
                                src={currentVideoImg || `https://img.youtube.com/vi/${currentVideoId}/maxresdefault.jpg`}
                                alt={currentVideoTitle}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Button
                                  onClick={handlePlayVideo}
                                  className="bg-red-600 hover:bg-red-700 rounded-full p-6"
                                >
                                  <Play className="w-12 h-12 text-white fill-white" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-white">
                        <div>
                          <h3 className="font-semibold">{currentVideoTitle}</h3>
                          {!isCreatorPage && !isVideoPlaying && (
                            <p className="text-sm text-purple-200 mt-1">
                              ▶️ Click the play button to start the video
                            </p>
                          )}
                          {!isCreatorPage && isVideoPlaying && queue.length > 0 && (
                            <div className="flex items-center gap-2 mt-2">
                              <p className="text-sm text-green-200">
                                🎵 Next: {queue[0]?.title || "No more songs"}
                              </p>
                              <Button
                                onClick={playNext}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-xs px-2 py-1"
                              >
                                Skip to Next
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-video rounded-lg bg-black/40 flex items-center justify-center">
                      <div className="text-center text-white">
                        <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>No video currently playing</p>
                        <p className="text-sm text-purple-200 mt-2">Songs will appear here when added to the queue</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center pt-2 border-t border-purple-500/20">
                    <div className="flex items-center gap-2 text-purple-200 text-sm">
                      <Users className="w-4 h-4" />
                      <span>{queue.length} songs in queue</span>
                    </div>
                    {!isCreatorPage && (
                      <Button
                        onClick={playNext}
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
                      <img 
                        src={`https://img.youtube.com/vi/${previewVideo}/mqdefault.jpg`}
                        alt="Video preview"
                        className="w-full h-full object-cover"
                      />
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
                          <Badge 
                            variant="secondary" 
                            className="absolute -top-1 -left-1 text-xs bg-purple-600 text-white"
                          >
                            #{index + 1}
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium truncate text-white">
                            {video.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Voting buttons */}
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

                          {/* Delete button */}
                          {!isCreatorPage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeFromQueue(video.id)}
                              className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                              title="Remove from queue"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
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