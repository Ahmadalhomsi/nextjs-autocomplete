import { NextResponse } from "next/server";
import { initSocket } from "@/lib/socket"; // Adjust the import path as necessary

export const config = {
  runtime: "edge", // Use edge runtime for better performance, or use default
};

export async function GET(request) {
  const server = await getServer();
  initSocket(server); // Ensure socket is initialized

  return NextResponse.json({ message: "Socket initialized" });
}
