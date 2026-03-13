import { PersonalCenterClient } from "@/features/deck-list/components/personal-center-client";
import { getDeckList } from "@/features/deck-list/server/get-deck-list";

export default async function PersonalCenterPage() {
  const decks = await getDeckList();
  return <PersonalCenterClient initialDecks={decks} />;
}
