import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const CreateStreamSchema = z.object({
    url: z.string(),
    type: z.enum(["Youtube", "Spotify"]),
});

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    
    const user = await prismaClient.user.findFirst({
        where: {
            email: session?.user?.email ?? ""
        }
    });
    
    if (!user) {
        return NextResponse.json({
            error: "Unauthorized"
        }, { status: 401 });
    }

    try {
        const data = CreateStreamSchema.parse(await req.json());
        
        // Extract YouTube ID
        function extractYouTubeId(url: string): string | null {
            const patterns = [
                /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
                /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match) return match[1];
            }
            return null;
        }
        
        const extractedId = extractYouTubeId(data.url);
        if (!extractedId) {
            return NextResponse.json({
                error: "Invalid YouTube URL"
            }, { status: 400 });
        }

        const stream = await prismaClient.stream.create({
            data: {
                url: data.url,
                type: data.type,
                extractedId,
                userId: user.id,
                title: "New Video", // You can fetch title from YouTube API later
                smallImg: `https://img.youtube.com/vi/${extractedId}/mqdefault.jpg`,
                bigImg: `https://img.youtube.com/vi/${extractedId}/maxresdefault.jpg`,
            }
        });

        return NextResponse.json({
            message: "Stream created successfully",
            stream
        });
    } catch (e) {
        return NextResponse.json({
            error: "Invalid data"
        }, { status: 400 });
    }
}




export async function GET(req: NextRequest) {
    const creatorId= req.nextUrl.searchParams.get("creatorId");
    
        const session = await getServerSession();
    
           const user = await prismaClient.user.findFirst({
                where: {
                    email: session?.user?.email ?? ""
                }
            });
            if(!user ) {
                return NextResponse.json({
                    error: "Unauthorized"
                }, { status: 401 });
            }
    if (!creatorId) {
        return NextResponse.json({
            error: "Creator ID is required"
        }, { status: 400 });
    }
      const streams = await prismaClient.stream.findMany({
        where: {
            userId: creatorId ?? "",
             active: true 

        },
        include: {
            _count: {
                select: {
                    upvotes: true,
                }
            },
            upvotes: {
                where: {
                    userId: user.id ?? ""
                }
            }
        },
    })        
        
return NextResponse.json({
    streams: streams.map(({_count, ...rest}) => ({
        ...rest,
        upvotes: _count.upvotes,
        haveUpvoted: rest.upvotes.length ? true : false,
    }))
})
}





