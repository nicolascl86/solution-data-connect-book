# Dogear — book discovery and learning journal

Dogear is a Next.js book discovery app adapted from a Firebase movie recommendation demo. We are developing the Google Books integration in small steps: make one change, understand it, run it, and verify the result before moving on.

## Where the project stands

Two parts work separately:

| Part | Address | Current behavior |
| --- | --- | --- |
| Dogear interface | http://localhost:3000 | Searches the original 12-book sample catalog, filters genres, ranks mood matches, shows book details, and saves a reading list on this browser/device. |
| Google Books endpoint | http://localhost:3000/api/books?q=dune | Searches the live Google Books catalog and returns JSON containing book IDs, titles, and authors. |

**The interface is not connected to the live catalog yet.** The JSON endpoint is the data-supplying part of the app. Opening it directly lets us inspect and test its output before displaying that output as book cards.

The current book integration needs the Books API and an API key. It does not need a database, Firebase Authentication, Cloud SQL, or Vertex AI. Existing Firebase and AI files are inherited from the original demo; their presence does not mean Dogear's live search uses them.

## 1. Get the project running on your computer

Install Node.js and pnpm, then run:

```sh
git clone https://github.com/nicolascl86/solution-data-connect-book.git
cd solution-data-connect-book
pnpm install
pnpm dev
```

`git clone` creates the project directory inside the directory where the command runs. If you have already created and entered an empty project directory, `git clone <repository-url> .` places the files directly inside it.

Open http://localhost:3000 and leave the development terminal running. Stop it with Control + C; start it again with `pnpm dev` from the project directory.

**What we learned:** `localhost` refers to the computer running the browser. A server in a separate cloud workspace cannot automatically be reached through your laptop's localhost. Running the cloned app on the Mac made that address accessible locally.

During installation, pnpm reported ignored dependency build scripts. Installation completed, and the app started successfully without approving those scripts. The pnpm update notice was optional; it was not a startup failure.

## 2. Enable Google Books

We reused the existing Google Cloud project `book-picker-app` (`book-picker-app-e30be`).

1. Select that project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Open **APIs & Services → Library**.
3. Find **Books API** (`books.googleapis.com`) and enable it.
4. Open **Credentials → Create credentials → API key**.
5. Give the new key a descriptive name, such as **Dogear Book Catalogue**.
6. Restrict the key to **Books API** only.
7. For this local server setup, leave application restrictions at **None**. Revisit application restrictions when deploying; browser website restrictions are not suitable for these server requests.
8. Check **Books API → Quotas and system limits** for the project's actual limits.

We created a separate key instead of modifying the existing Firebase browser key. No OAuth consent screen or service-account binding was needed for this public catalog search.

## 3. Store the key outside source code

Create `.env.local` in the project root, alongside `package.json`:

```env
GOOGLE_BOOKS_API_KEY=your_actual_key_here
```

This is a placeholder, not a real key. Keep the real value private, and optionally store a backup in a password manager.

Verify that Git ignores the file:

```sh
git check-ignore .env.local
```

Expected output: `.env.local`. If nothing prints, add `.env.local` to `.gitignore` before committing.

Next.js loads this file automatically. Restart `pnpm dev` after changing environment configuration. Do not use a `NEXT_PUBLIC_` prefix for this key: the Google request belongs on the server.

**What we learned:**

- `process.env.GOOGLE_BOOKS_API_KEY` reads the configured value.
- `Boolean(apiKey)` checks whether it is present and nonempty; it does not validate the key with Google.
- `apiKey !== apiKey?.trim()` checks for surrounding whitespace without printing the key.
- An interface or a browser response should never contain the actual secret.

## 4. Verify Google access independently

An initial browser request without a key returned 429 and referred to a different consumer project. That did not establish that our project's quota was exhausted.

We tested our own key with a standalone Node request from the project directory:

```sh
node --env-file=.env.local -e '
const url = new URL("https://www.googleapis.com/books/v1/volumes");
url.searchParams.set("q", "dune");
url.searchParams.set("maxResults", "5");
fetch(url, {
  headers: { "X-Goog-Api-Key": process.env.GOOGLE_BOOKS_API_KEY }
}).then(async response => {
  console.log("HTTP status:", response.status);
  console.log(JSON.stringify(await response.json(), null, 2));
}).catch(console.error);
'
```

The result was HTTP 200 with book data. This test loads the key without writing it into shell history or the browser URL. It requires a Node version supporting `--env-file` and `fetch`.

## 5. Create a minimal Next.js endpoint

Open the project folder in VS Code (we initially used Sublime). The existing `src` directory contains the source code. Create `books/route.ts` inside `src/app/api`:

```text
src/
└── app/
    └── api/
        └── books/
            └── route.ts
```

Our first version was:

```ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "My book endpoint works",
  });
}
```

Opening http://localhost:3000/api/books returned that message.

**What we learned:**

- Next.js maps this particular `route.ts` location to `/api/books`.
- `GET` handles a GET request, such as opening the address in a browser.
- `export` makes the function available to Next.js.
- `NextResponse.json` sends a JSON response, not a visual page.

## 6. Read a search from the URL

We added `NextRequest` to the import, accepted `request: NextRequest`, and read:

```ts
const query = request.nextUrl.searchParams.get("q");
```

We first returned `search: query` to inspect it. Both `?q=circe` and `?q=dune` returned the matching text.

**What we learned:** the part after `?` contains query parameters. `q` is the parameter name; its value becomes the search text. `NextRequest` describes the incoming request.

We then returned `keyConfigured: Boolean(apiKey)` temporarily and confirmed that Next.js could read the key without exposing it.

## 7. Build and send the Google request

We constructed the URL separately before calling it:

```ts
const url = new URL("https://www.googleapis.com/books/v1/volumes");
url.searchParams.set("q", query ?? "");
url.searchParams.set("maxResults", "5");
```

`URL` handles the address and query encoding. `maxResults` asks for up to five results. `url.toString()` allowed us to inspect the generated address without including the secret.

After checking for a missing key, we added:

```ts
const response = await fetch(url, {
  headers: {
    "X-Goog-Api-Key": apiKey,
  },
  cache: "no-store",
});
```

- `fetch` sends the request from the Next.js server.
- The header carries the key to Google without returning it to the browser.
- `await` waits for the operation to complete; the handler is marked `async`.
- `cache: "no-store"` requests fresh data rather than using Next.js's fetch cache. It is not a proven fix for the observed 503 failures.
- `response.status` reports Google's HTTP status.
- `response.ok` indicates a status between 200 and 299.

We first returned only the status and success flag, then verified a 200 response before reading the body.

## 8. Read JSON and handle unsuccessful responses

```ts
const data = await response.json();
```

This reads the response body and parses JSON into JavaScript data. It is a separate step from receiving the response headers/status.

We check `!response.ok` before transforming book results. On failure, the endpoint returns Google's status and error message. On success, it continues to process `data.items`.

**What we learned:** `data.items ?? []` provides an empty list if `items` is absent, but without an explicit error check that could hide a failed request as an empty search result.

## 9. Reject empty searches before contacting Google

Immediately after reading the query, we added:

```ts
if (!query || !query.trim()) {
  return NextResponse.json(
    { error: "Please enter a search item." },
    { status: 400 }
  );
}
```

- `!` means “not.”
- `||` means “or.”
- `.trim()` removes leading and trailing spaces.
- The condition means “the query is missing/empty, or it contains only whitespace.”
- `return` stops execution before a Google request is sent.
- HTTP 400 indicates a problem with the incoming request.

A missing `!` before `query.trim()` initially rejected valid searches. Restoring it fixed the condition. We verified both a valid query and a missing query after correcting it.

## 10. Return a smaller book structure

Google's raw response contains many fields. We used `.map()` to create a new list containing only what we currently need.

To avoid putting a complicated nested type directly in `.map()`, we defined a named interface below the imports:

```ts
interface GoogleBook {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
  };
}
```

Then we referred to that description by name:

```ts
const books = (data.items ?? []).map((book: GoogleBook) => {
  return {
    id: book.id,
    title: book.volumeInfo.title ?? "Untitled",
    authors: book.volumeInfo.authors ?? [],
  };
});
```

The endpoint returns `search`, `googleStatus`, and `books`.

**What we learned:**

- An interface describes an expected structure; it does not create an object or fetch anything.
- `book: GoogleBook` tells TypeScript which structure to expect.
- `?` marks a property as optional.
- `string[]` means a list of strings, supporting multiple authors.
- `??` supplies a fallback for `null` or `undefined`.
- `.map()` transforms each entry into a new object and returns a new list.
- The interface describes Google's nested input; our returned object has a simpler, flat structure.
- TypeScript does not validate external JSON at runtime. Runtime validation remains future work.

We initially put `authors` outside `volumeInfo` in the type description. VS Code correctly flagged `book.volumeInfo.authors`. Moving the property inside `volumeInfo` fixed the type error. The request had still run because Google's actual data contained that nested field; development execution does not guarantee all TypeScript checks pass.

The example above spells the fallback “Untitled”; the endpoint at this checkpoint has the harmless spelling typo “Unititled,” which can be corrected in the next cleanup.

## 11. Troubleshooting we observed

| Observation | What it established / action taken |
| --- | --- |
| A keyless browser request returned 429 for another project | It did not establish our own key's quota state. A keyed terminal test returned 200. |
| Google returned 503 with `reason: "backendFailed"` | Google reported a backend failure for that request. The endpoint surfaced the error rather than claiming no books matched. |
| Direct Node requests sometimes returned 200 while the app returned 503 | We compared URLs, checked key presence/whitespace, and disabled fetch caching. These checks did not establish the root cause. |
| Requests succeeded after restarting `pnpm dev` | Recovery was observed after restarts, but causation was not confirmed. Google may also have recovered during that time. |
| One development request returned 500 | Its underlying error was not captured, so its cause remains unconfirmed. |
| Starting Next.js with `node --env-file=.env.local ... next dev` produced a `NODE_OPTIONS` error | We returned to `pnpm dev`. The standalone Node test supports the flag, but that Next.js startup path failed in this setup. |
| VS Code reported that `authors` did not exist in `volumeInfo` | The interface nesting was wrong; correcting the braces fixed the type description. |

The earlier suggestions about stale keys or caching were diagnostic possibilities, not confirmed causes. No API key rotation or quota increase was established as necessary.

## 12. Save progress with Git and GitHub

From the project root:

```sh
git status
git diff -- src/app/api/books/route.ts
git check-ignore .env.local
git add src/app/api/books/route.ts
git diff --cached
git commit -m "feat: add Google Books search endpoint"
git push origin main
```

Review staged changes before committing. The real key must never be included. We pushed working checkpoints from the Mac so the endpoint changes are now part of the repository.

## Checks completed during this learning session

These are manual checks observed during development, not a claim that a new automated test suite exists:

- Dogear runs on the personal Mac using `pnpm dev`.
- `.env.local` is ignored by Git.
- A keyed standalone Google Books request returns 200 and catalog data.
- The minimal endpoint returns its test message.
- The endpoint reads different query values correctly.
- The server reports that its key is configured without revealing the key.
- Successful Google responses yield book IDs, titles, and author lists.
- Missing queries return 400; valid queries proceed to Google.
- Google's unsuccessful responses are surfaced with their error/status.
- The interface nesting correction removed the observed VS Code type error.

## Next learning milestone

Connect the live data to a visual page, one testable change at a time:

1. Display returned titles and authors on a simple page.
2. Add loading, empty-result, and error states.
3. Add covers and fallbacks for missing information.
4. Connect the existing Dogear search and book cards to the endpoint.
5. Adapt saved books to preserve live catalog IDs and display information.

Before treating the endpoint as production-ready, add network/timeout handling, stronger input and response validation, and a deliberate approach to transient failures. These are not implemented merely by documenting them here.

## Useful files

| File | Purpose |
| --- | --- |
| `src/app/api/books/route.ts` | Live Google Books search endpoint developed in these lessons. |
| `src/app/page.tsx` | Dogear home page entry point. |
| `src/components/book-discovery.tsx` | Current visual interface and browser-local reading list. |
| `src/lib/books.ts` | Original sample catalog and mood tags. |
| `public/covers/` | Local sample-book cover images sourced from Open Library. |
| `.env.local` | Local secret configuration; intentionally untracked. |
| `package.json` | Dependencies and development/build commands. |

## Project checks

```sh
pnpm exec tsc --noEmit
pnpm build
```

A successful page request does not replace a TypeScript check or production build. These commands are useful checkpoints as the project grows.

## Original demo reference

The repository originated as FriendlyMovies, a Firebase Data Connect / Vertex AI demonstration. Its original setup and attribution are preserved in [the original movie demo documentation](docs/original-movie-demo.md). Those instructions describe the inherited movie system, not requirements for the current Dogear catalog endpoint.
