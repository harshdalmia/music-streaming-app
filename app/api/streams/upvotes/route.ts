import { prismaClient } from "@/app/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const Upvoteschema = z.object({
    streamId: z.string(),
});
export async function POST(req: NextRequest) {
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


    try{
        const data = Upvoteschema.parse(await req.json());
        await prismaClient.upvotes.create({
            data: {
                userId: user.id,
                streamId: data.streamId
            }
        });
        return NextResponse.json({
            message: "Upvoted successfully"
        });
    }
    catch(e) {
        return NextResponse.json({
            error: "Invalid data"
        }, { status: 400 });
    }
}