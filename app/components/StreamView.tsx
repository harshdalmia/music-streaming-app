"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronUp, ChevronDown, Play, Users, Plus, Share, X } from "lucide-react"
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
  const { data: session } = useSession()
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null)
  const [queue, setQueue] = useState<Video[]>([])
  const [streams, setStreams] = useState<Video[]>([])
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [previewVideo, setPreviewVideo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shareMessage, setShareMessage] = useState("")
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  
  // Consolidated fetch function
  const fetchStreams = async () => {
    try {
      const response = await fetch(`/api/streams?creatorId=${creatorId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Only get active streams
        const activeStreams = data.streams.filter((stream: Video) => stream.active);
        setStreams(activeStreams);
        
        // Sort by upvotes and update queue
        const sortedStreams = activeStreams.sort((a: Video, b: Video) => b.upvotes - a.upvotes);
        setQueue(sortedStreams);
        
        // Set current video if none is playing
        if (!currentVideo && sortedStreams.length > 0) {
          setCurrentVideo(sortedStreams[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching streams:', error);
    }
  };

  // Auto play next song when current song ends
  const playNextAutomatically = async () => {
    if (queue.length <= 1) {
      // No more songs in queue
      setCurrentVideo(null);
      setIsVideoPlaying(false);
      return;
    }

    const nextStream = queue[1]; // Get next song (current is at index 0)
    
    try {
      // Mark the current song as inactive
      if (currentVideo) {
        await fetch(`/api/streams/${currentVideo.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ active: false }),
        });
      }
      
      // Set the next song as current
      setCurrentVideo(nextStream);
      setIsVideoPlaying(true);
      
      // Remove current song from queue
      const newQueue = queue.slice(1);
      setQueue(newQueue);
      
      // Refresh streams
      setTimeout(() => {
        fetchStreams();
      }, 1000);
    } catch (error) {
      console.error('Error auto-playing next song:', error);
    }
  };

  useEffect(() => {
    if (creatorId) {
      fetchStreams();
      const interval = setInterval(fetchStreams, 10000);
      return () => clearInterval(interval);
    }
  }, [creatorId]);

  // YouTube player event handler
  useEffect(() => {
    if (!isCreatorPage && currentVideo) {
      const handleYouTubeEvent = (event: any) => {
        // YouTube player states: 0 = ended, 1 = playing, 2 = paused
        if (event.data === 0) { // Video ended
          playNextAutomatically();
        }
      };

      // Listen for YouTube player events
      const iframe = document.querySelector('iframe[src*="youtube.com"]') as HTMLIFrameElement;
      if (iframe) {
        iframe.addEventListener('load', () => {
          // YouTube API will be available after iframe loads
          if (window.YT && window.YT.Player) {
            // Create YouTube player instance to listen for events
            new window.YT.Player(iframe, {
              events: {
                onStateChange: handleYouTubeEvent
              }
            });
          }
        });
      }
    }
  }, [currentVideo, queue, isCreatorPage]);

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
      await axios.post("/api/streams", {
        url: newVideoUrl,
        type: "Youtube"
      });
      
      // Refresh streams after adding
      await fetchStreams();
      
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
                        haveUpvoted: increment > 0
                    } 
                    : video
            ).sort((a, b) => b.upvotes - a.upvotes)
        );

        // Refresh to get accurate data
        setTimeout(() => fetchStreams(), 1000);
    } catch (error) {
        console.error("Failed to vote:", error);
        if (axios.isAxiosError(error) && error.response?.data?.error === "Already upvoted") {
            alert("You have already voted for this song!");
        }
    }
  }

  // Manual play next function
  const handlePlayNext = async () => {
    if (queue.length === 0) {
      setCurrentVideo(null);
      return;
    }

    const nextStream = queue[0];
    
    try {
      // Mark the current song as inactive in the database
      const response = await fetch(`/api/streams/${nextStream.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: false }),
      });

      if (response.ok) {
        // Set the next song as current
        setCurrentVideo(nextStream);
        setIsVideoPlaying(true);
        
        // Remove from local queue state immediately
        const newQueue = queue.filter(stream => stream.id !== nextStream.id);
        setQueue(newQueue);
        
        // Refresh the streams to get updated data
        setTimeout(() => {
          fetchStreams();
        }, 2000);
      }
    } catch (error) {
      console.error('Error marking stream as inactive:', error);
    }
  };

  const removeFromQueue = async (streamId: string) => {
    try {
      const response = await fetch(`/api/streams/${streamId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: false }),
      });

      if (response.ok) {
        // Remove from local state immediately
        const newQueue = queue.filter(stream => stream.id !== streamId);
        setQueue(newQueue);
        
        // Refresh streams
        fetchStreams();
      }
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  };

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
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentVideo ? (
                    <>
                      {isCreatorPage ? (
                        // Creator preview
                        <div className="aspect-video rounded-lg overflow-hidden bg-black/40 relative">
                          <img 
                            src={currentVideo.bigImg || `https://img.youtube.com/vi/${currentVideo.extractedId}/maxresdefault.jpg`}
                            alt={currentVideo.title}
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
                        // Fan page with auto-play functionality
                        <div className="aspect-video rounded-lg overflow-hidden relative">
                          {isVideoPlaying ? (
                            <YouTubeEmbed 
                              videoid={currentVideo.extractedId} 
                              height={400} 
                              params="controls=1&autoplay=1&rel=0&modestbranding=1&enablejsapi=1"
                            />
                          ) : (
                            <div className="relative w-full h-full bg-black">
                              <img 
                                src={currentVideo.bigImg || `https://img.youtube.com/vi/${currentVideo.extractedId}/maxresdefault.jpg`}
                                alt={currentVideo.title}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                <Button
                                  onClick={() => setIsVideoPlaying(true)}
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
                          <h3 className="font-semibold">{currentVideo.title}</h3>
                          {!isCreatorPage && !isVideoPlaying && (
                            <p className="text-sm text-purple-200 mt-1">
                              ▶️ Click the play button to start the video
                            </p>
                          )}
                          {!isCreatorPage && isVideoPlaying && queue.length > 1 && (
                            <p className="text-sm text-green-200 mt-1">
                              🎵 Next: {queue[1]?.title || "No more songs"}
                            </p>
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
                        <img 
                          src={`https://img.youtube.com/vi/${previewVideo}/mqdefault.jpg`}
                          alt="Video preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <YouTubeEmbed 
                          videoid={previewVideo} 
                          height={200} 
                          params="controls=1&rel=0&modestbranding=1" 
                        />
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
                      className={`bg-white/5 rounded-lg p-3 border transition-colors ${
                        video.id === currentVideo?.id 
                          ? 'border-green-500/50 bg-green-500/10' 
                          : 'border-purple-500/20 hover:bg-white/10'
                      }`}
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
                            className={`absolute -top-1 -left-1 text-xs ${
                              video.id === currentVideo?.id 
                                ? 'bg-green-600 text-white' 
                                : 'bg-purple-600 text-white'
                            }`}
                          >
                            {video.id === currentVideo?.id ? '🎵' : `#${index + 1}`}
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium truncate ${
                            video.id === currentVideo?.id ? 'text-green-300' : 'text-white'
                          }`}>
                            {video.title}
                          </h4>
                          {video.id === currentVideo?.id && (
                            <p className="text-xs text-green-400 mt-1">Now Playing</p>
                          )}
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

                          {/* Delete button - only visible on dashboard */}
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

      {/* Add YouTube API script */}
      <script src="https://www.youtube.com/iframe_api" async></script>
    </div>
  )
}