/**
 * 404 page, built from the shared hero and buttons.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  src/ui/pages/not-found.tsx
 * Deps:    src/contracts/pages.ts, src/ui/components/shell.ts, src/ui/components/blocks.ts
 * Tested:  test/ui/pages/scorecard.test.tsx, test/app/pages.test.ts
 */
import type { PageRenderer, NotFoundPageProps } from "../../contracts/pages";
import { shell } from "../components/shell";
import { button, hero } from "../components/blocks";

export const renderNotFound: PageRenderer<NotFoundPageProps> = ({ path }) =>
  shell({
    title: "Not found",
    active: null,
    body:
      hero({ eyebrow: "Zora Agent Lab", title: "Nothing at this address", lead: `There is nothing at ${path}.` }) +
      button({ label: "Top deals", href: "/" }) +
      button({ label: "Find a deal", href: "/find", tone: "secondary" }),
  });
