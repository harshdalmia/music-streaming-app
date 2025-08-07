import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { streamId } = await req.json();
        
        if (!streamId) {
            return NextResponse.json({
                error: "Stream ID is required"
            }, { status: 400 });
        }

        const session = await getServerSession();

        if (session?.user?.email) {
            // Registered user voting
            let user = await prismaClient.user.findFirst({
                where: {
                    email: session.user.email
                }
            });

            // Create user if they don't exist
            if (!user) {
                user = await prismaClient.user.create({
                    data: {
                        email: session.user.email,
                        provider: "Google"
                    }
                });
            }

            // Check if user already upvoted
            const existingUpvote = await prismaClient.upvotes.findFirst({
                where: {
                    userId: user.id,
                    streamId: streamId
                }
            });

            if (existingUpvote) {
                return NextResponse.json({
                    error: "Already upvoted"
                }, { status: 400 });
            }

            // Create upvote
            await prismaClient.upvotes.create({
                data: {
                    userId: user.id,
                    streamId: streamId
                }
            });
        } else {
            // Anonymous user voting - increment anonymousVotes
            await prismaClient.stream.update({
                where: {
                    id: streamId
                },
                data: {
                    anonymousVotes: {
                        increment: 1
                    }
                }
            });
        }

        // Get updated stream data
        const stream = await prismaClient.stream.findUnique({
            where: { id: streamId },
            include: {
                _count: {
                    select: { upvotes: true }
                }
            }
        });

        const totalVotes = (stream?._count.upvotes || 0) + (stream?.anonymousVotes || 0);

        return NextResponse.json({
            message: "Upvoted successfully",
            upvotes: totalVotes
        });
    } catch (error) {
        console.error("Failed to upvote:", error);
        return NextResponse.json({
            error: "Failed to upvote"
        }, { status: 500 });
    }
}