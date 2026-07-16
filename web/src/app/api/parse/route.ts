import { NextResponse } from 'next/server';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzAwMDY1NjE3YTM1NzExNzUwM2IxYmQ5NTVjMGRmMmZkEgsSBxDhl9H_6wkYAZIBIwoKcHJvamVjdF9pZBIVQhM1MDUzOTA0MjU3ODc1NTAzNTM5&filename=&opi=89354086";
  const res = await fetch(url);
  const text = await res.text();
  fs.writeFileSync('/home/kingusang/Kanvise/web/public/landing.html', text);
  return NextResponse.json({ success: true });
}
