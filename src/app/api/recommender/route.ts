import { NextResponse } from 'next/server';
import { books } from '@/lib/books';
export async function POST(request: Request) {
 let input: unknown;
 try { input = await request.json(); } catch { return NextResponse.json({error:'Expected a JSON request body.'},{status:400}); }
 if (!input || typeof input !== 'object') return NextResponse.json({error:'Expected an object.'},{status:400});
 const { mood, genre } = input as { mood?: unknown; genre?: unknown };
 if ((mood !== undefined && typeof mood !== 'string') || (genre !== undefined && typeof genre !== 'string')) return NextResponse.json({error:'Mood and genre must be strings.'},{status:400});
 const recommendations=books.filter(book=>(!genre||genre==='All books'||book.genre===genre)&&(!mood||book.moods.includes(mood)));
 return NextResponse.json({recommendations, source:'curated-catalog'});
}
