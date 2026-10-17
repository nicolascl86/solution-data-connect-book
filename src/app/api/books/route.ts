import {NextResponse, NextRequest} from "next/server";
interface GoogleBook {
	id: string;
	volumeInfo: {
		title?: string;
		authors?: string[];
	};
}

export async function GET(request: NextRequest) {
	const query = request.nextUrl.searchParams.get("q");
		if (!query || !query.trim()) {
			return NextResponse.json ({
				error: "Please enter a search item."
			},
		{
			status: 400
		});
		}
	const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
	console.log("Books key loaded:", Boolean(apiKey));
	console.log("Books key has surrounding spaces:", apiKey !== apiKey?.trim());
	const url = new URL("https://www.googleapis.com/books/v1/volumes");

	url.searchParams.set("q", query ?? "");
	url.searchParams.set("maxResults", "5");

	if (!apiKey) {
		return NextResponse.json(
			{error: "Google Books API key is missing" },
			{status: 500 }
		);
	}
		console.log("Google Books URL:", url.toString());
		const response = await fetch(url, {
			headers: {
				"X-Goog-Api-Key": apiKey,
			},
			cache: "no-store",
		});

		const data = await response.json();

		if (!response.ok) {
			console.log("Google Books error:", JSON.stringify(data));
			return NextResponse.json({
				googleStatus: response.status,
				error: data.error?.message ?? "Google Books is unavailable",
			},
		{
			status: response.status
		});
		}
		const books = (data.items ?? []).map(
			(book: GoogleBook) => {
				return {
					id: book.id,
					title: book.volumeInfo.title ?? "Unititled",
					authors: book.volumeInfo.authors ?? [],
				};
			}
		); 
	
	return NextResponse.json ({
		search: query,
		googleStatus: response.status,
		books: books, 
	});

}