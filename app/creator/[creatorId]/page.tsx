"use client";

import { use } from "react";
import StreamView from "@/app/components/StreamView";

export default function CreatorPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  // Unwrap the params promise using React.use()
  const { creatorId } = use(params);

  return (
    <StreamView
      creatorId={creatorId}
      isCreatorPage={true} // This will show thumbnails and hide Play Next
    />
  );
}