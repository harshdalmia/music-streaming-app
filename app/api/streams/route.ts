import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/app/lib/auth";


export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Get user from database
        const user = await prismaClient.user.findUnique({
            where: { email: session.user.email },
            select: { id: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const data = await req.json();
        const { url, type } = data;

        if (!url || !type) {
            return NextResponse.json({ error: "URL and type are required" }, { status: 400 });
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
                title = `YouTube Video ${extractedId}`;
                smallImg = `https://img.youtube.com/vi/${extractedId}/default.jpg`;
                bigImg = `https://img.youtube.com/vi/${extractedId}/maxresdefault.jpg`;
            } else {
                return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
            }
        }

        const stream = await prismaClient.stream.create({
            data: {
                type,
                url,
                extractedId,
                title,
                smallImg,
                bigImg,
                userId: user.id,
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
            ],
        });

        return NextResponse.json({
            streams: streams.map((stream) => ({
                ...stream,
                upvotes: stream._count.upvotes + stream.anonymousVotes,
            })),
        });
    } catch (error) {
        console.error("Error fetching streams:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}






