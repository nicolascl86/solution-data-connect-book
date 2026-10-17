import {NextResponse, NextRequest} from "next/server";

export async function GET(request: NextRequest) {
	const query = request.nextUrl.searchParams.get("q");
	const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
	const url = new URL("https://www.googleapis.com/books/v1/volumes");

	url.searchParams.set("q", query ?? "");
	url.searchParams.set("maxResults", "5");

	if (!apiKey) {
		return NextResponse.json(
			{error: "Google Books API key is missing" },
			{status: 500 }
		);
	}

		const response = await fetch(url, {
			headers: {
				"X-Goog-Api-Key": apiKey,
			},
		});

		const data = await response.json();

		if (!response.ok) {
			return NextResponse.json({
				googleStatus: response.status,
				error: data.error?.message ?? "Google Books is unavailable",
			},
		{
			status: response.status
		});
		}

	return NextResponse.json ({
		search: query,
		googleStatus: response.status,
		books: data.items ?? [], 
	});

}