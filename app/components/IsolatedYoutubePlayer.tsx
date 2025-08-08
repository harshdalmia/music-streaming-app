"use client"

import { useEffect, useRef, useState } from "react"

interface IsolatedYouTubePlayerProps {
  videoId: string
  onVideoEnd?: () => void
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

const IsolatedYouTubePlayer = ({ videoId, onVideoEnd }: IsolatedYouTubePlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const currentVideoIdRef = useRef<string>("")
  const [isAPIReady, setIsAPIReady] = useState(false)

  // Load YouTube API
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setIsAPIReady(true)
      return
    }

    // Load YouTube IFrame API if not already loaded
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      document.head.appendChild(script)
    }

    // Set up API ready callback
    window.onYouTubeIframeAPIReady = () => {
      setIsAPIReady(true)
    }
  }, [])

  // Create player when API is ready
  useEffect(() => {
    if (!isAPIReady || !containerRef.current || !videoId) return

    // Only create player if it doesn't exist or video changed
    if (!playerRef.current || currentVideoIdRef.current !== videoId) {
      // Destroy existing player
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy()
      }

      // Clear container
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }

      // Create new player
      const playerId = `youtube-player-${Date.now()}`
      const playerDiv = document.createElement('div')
      playerDiv.id = playerId
      containerRef.current?.appendChild(playerDiv)

      playerRef.current = new window.YT.Player(playerId, {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          enablejsapi: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            console.log('YouTube player ready')
            event.target.playVideo()
          },
          onStateChange: (event: any) => {
            // 0 = ended, 1 = playing, 2 = paused, 3 = buffering, 5 = video cued
            if (event.data === 0 && onVideoEnd) {
              console.log('Video ended, playing next')
              onVideoEnd()
            }
          },
          onError: (event: any) => {
            console.error('YouTube player error:', event.data)
          }
        }
      })

      currentVideoIdRef.current = videoId
    }
  }, [isAPIReady, videoId, onVideoEnd])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        playerRef.current.destroy()
      }
    }
  }, [])

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}

export default IsolatedYouTubePlayer
