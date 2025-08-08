import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { url, type, creatorId } = data;

        if (!url || !type) {
            return NextResponse.json({ error: "URL and type are required" }, { status: 400 });
        }

        // Try to get logged in user first
        const session = await getServerSession(authOptions);
        let userId = null;

        if (session?.user?.email) {
            const user = await prismaClient.user.findUnique({
                where: { email: session.user.email },
                select: { id: true }
            });
            userId = user?.id;
        }

        // If no logged in user, use creatorId for anonymous submissions
        if (!userId) {
            const { searchParams } = new URL(req.url);
            const urlCreatorId = searchParams.get("creatorId") || creatorId;
            
            if (!urlCreatorId) {
                return NextResponse.json({ error: "Creator ID is required for anonymous submissions" }, { status: 400 });
            }
            
            userId = urlCreatorId;
        }

        // Extract video ID and get metadata
        let extractedId = "";
        let title = "";
        let smallImg = "";
        let bigImg = "";

        if (type === "Youtube") {
            // Extract YouTube video ID
            const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
            const match = url.match(youtubeRegex);
            
            if (match) {
                extractedId = match[1];
                
                // Try to get actual video title using oEmbed API
                try {
                    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${extractedId}&format=json`);
                    if (response.ok) {
                        const data = await response.json();
                        title = data.title || `YouTube Video ${extractedId}`;
                    } else {
                        title = `YouTube Video ${extractedId}`;
                    }
                } catch {
                    title = `YouTube Video ${extractedId}`;
                }
                
                smallImg = `https://img.youtube.com/vi/${extractedId}/mqdefault.jpg`;
                bigImg = `https://img.youtube.com/vi/${extractedId}/maxresdefault.jpg`;
            } else {
                return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
            }
        }

        // Check if this video already exists in the active queue for this creator
        const existingStream = await prismaClient.stream.findFirst({
            where: {
                extractedId,
                userId: creatorId || userId,
                active: true
            }
        });

        if (existingStream) {
            return NextResponse.json({ error: "This video is already in the queue" }, { status: 400 });
        }

        const stream = await prismaClient.stream.create({
            data: {
                type,
                url,
                extractedId,
                title,
                smallImg,
                bigImg,
                userId: creatorId || userId,
                active: true,
                anonymousVotes: 0,
            },
        });

        return NextResponse.json({ stream });
    } catch (error) {
        console.error("Error creating stream:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const creatorId = searchParams.get("creatorId");

        if (!creatorId) {
            return NextResponse.json({ error: "Creator ID is required" }, { status: 400 });
        }

        // Get the current user's ID to check if they've voted
        const session = await getServerSession(authOptions);
        let currentUserId = null;

        if (session?.user?.email) {
            const user = await prismaClient.user.findUnique({
                where: { email: session.user.email },
                select: { id: true }
            });
            currentUserId = user?.id;
        }

        const streams = await prismaClient.stream.findMany({
            where: {
                userId: creatorId,
                active: true,
            },
            include: {
                _count: {
                    select: {
                        upvotes: true,
                    },
                },
                upvotes: currentUserId ? {
                    where: {
                        userId: currentUserId
                    }
                } : false
            },
            orderBy: [
                {
                    upvotes: {
                        _count: "desc",
                    },
                },
                {
                    anonymousVotes: "desc",
                },
                {
                    id: "asc", // Secondary sort for consistency
                },
            ],
        });

        // Get the currently playing stream (if any)
        const currentlyPlaying = streams.length > 0 ? streams[0] : null;

        return NextResponse.json({
            streams: streams.map((stream) => ({
                ...stream,
                upvotes: stream._count.upvotes + stream.anonymousVotes,
                haveUpvoted: currentUserId ? stream.upvotes.length > 0 : false,
                isCurrentlyPlaying: currentlyPlaying ? stream.id === currentlyPlaying.id : false, // Add this field
            })),
            currentlyPlaying: currentlyPlaying ? {
                ...currentlyPlaying,
                upvotes: currentlyPlaying._count.upvotes + currentlyPlaying.anonymousVotes,
                haveUpvoted: currentUserId ? currentlyPlaying.upvotes.length > 0 : false,
            } : null
        });
    } catch (error) {
        console.error("Error fetching streams:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}






