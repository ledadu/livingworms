// The data of the « Nouveautés »: whatsNew() of the agents framework (agents/release/changes.mjs), that
// whatsNewPlugin.mjs writes into the page. In dev: every version with the one in preparation, images served from
// changes/. In the built page: the published versions, each entry with its first image embedded.
import type { EntryType, WhatsNew, WhatsNewEntry, WhatsNewRelease } from '../../../agents/release/changes.mjs';

export type { EntryType, WhatsNew, WhatsNewEntry, WhatsNewRelease };

// The id of the JSON script in the page (also in whatsNewPlugin.mjs).
export const DATA_ID = 'whats-new-data';

export function readData(doc: Document = document): WhatsNew | null {
  const text = doc.getElementById(DATA_ID)?.textContent;
  if (!text) return null;
  try {
    const data = JSON.parse(text) as WhatsNew;
    return Array.isArray(data?.releases) ? data : null;
  } catch {
    return null;
  }
}
