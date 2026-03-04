const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";

type ApiEnvelope<T> = T & {
  ok: boolean;
  message?: string;
  code?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message ?? `Request failed: ${response.status}`);
  }

  return payload;
}

async function run() {
  console.log(`smoke start: ${baseUrl}`);

  const createdDeck = await requestJson<{ deck: { id: string } }>("/api/decks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `smoke-${Date.now()}`,
    }),
  });
  const deckId = createdDeck.deck.id;
  console.log(`created deck: ${deckId}`);

  const createdSlide = await requestJson<{ slide: { id: string; version: number; deckId: string } }>(
    `/api/decks/${deckId}/slides`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  const slideId = createdSlide.slide.id;
  console.log(`created slide: ${slideId}`);

  const xmlContent =
    '<slide id="smoke-slide"><style><fill><fillColor color="rgba(252, 252, 252, 1)"/></fill></style><data></data><note id="smoke-note"><content><p>smoke</p></content></note></slide>';

  const saved = await requestJson<{ slide: { id: string; version: number } }>(`/api/slides/${slideId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: createdSlide.slide.version,
      xmlContent,
    }),
  });
  console.log(`saved slide version: ${saved.slide.version}`);

  const loaded = await requestJson<{ slides: Array<{ id: string; xmlContent: string; version: number }> }>(
    `/api/decks/${deckId}/slides`,
  );
  const loadedSlide = loaded.slides.find((slide) => slide.id === slideId);
  if (!loadedSlide) {
    throw new Error("smoke failed: created slide not found in list");
  }

  if (loadedSlide.xmlContent !== xmlContent) {
    throw new Error("smoke failed: persisted xml content mismatch");
  }

  console.log("smoke success");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
