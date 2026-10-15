# Research: the original orange Striver A2Z sheet

Research date: October 15, 2026.

## What the older interface emphasized

The older 455-entry sheet used a light page, orange highlights, a course title/introduction, an overall progress bar, a revision action, and numbered step accordions. Inside each step, lecture groups contained dense question tables: completion, problem title, learning/practice resources, revision, and difficulty. The hierarchy was step → lecture → question rather than today's module/learning-experience hub. Historical screenshots show different revisions; this implementation is a recreation of that visual language, not a pixel-exact snapshot of one historical date.

The implementation retains the orange palette, clear progress, numbered expandable steps, nested lectures, resource icons and question rows. It adds search and filters, notes, backups, and browser-local storage. Promotional banners, login, and premium flows are omitted from this personal learning frontend.

## Sources

- Original sheet URL (now redirects): https://takeuforward.org/strivers-a2z-dsa-course/strivers-a2z-dsa-course-sheet-2/
- Current official page: https://takeuforward.org/prep-hub/strivers-a2z-dsa-sheet
- Historical data archive: https://github.com/Bugaddr/a2z_old_sheet
- Archive viewer: https://bugaddr.github.io/a2z_old_sheet/
- Older 2024 interface screenshot in a public progress post: https://www.linkedin.com/posts/tanish-gupta-5a283121b_dsa-strivera2zdsacourse-takeuforward-activity-7252009263571574786-JItn
- Official takeUforward development homepage screenshot: https://static.takeuforward.org/content/sheet.png
- Creator channel: https://www.youtube.com/@takeUforward

## Content audit

The archived JSON has 455 entries across 18 steps and 61 lecture groups. All original titles, order and timestamps are retained. Empty resource values are empty strings in the normalized dataset and empty table cells in the UI.

The source has 24 fields with a URL on a different platform than its field label. Those are blanked, and every original value is preserved in `link-issues.json` and the unmodified source JSON. Counts after filtering: 269 LeetCode, 439 GFG, 387 YouTube, 325 articles. Difficulty labels are taken from the archive's numeric labels, not freshly checked against each platform.

Verification covers completeness, unique IDs, original order, URL syntax, platform hosts, production static export, and browser interactions. It does not certify remote link liveness, question equivalence for every archived mapping, or independently verify the uploader for each YouTube URL. YouTube returned rate-limit responses during direct research. The complete resource inventory is available in `data/questions.csv`.

## Section progress UI refinement

The following screenshot shows the older full-width orange progress strip along each step card's top edge, a solved/total badge, square chevron controls, collapsible Key Highlights / Note panels, and Show Revision / shuffle actions:
https://miro.medium.com/v2/resize:fit:1400/1*ouDztkS_pLQvi4qcOj7jYQ.png
Context: https://medium.com/@riyabanik003/how-i-started-solving-strivers-a2z-dsa-sheet-what-i-learned-5d95a45dcbde

The recreation now uses that full-width strip for steps. Lecture completion bars, percentages, difficulty bars, and completed-step counts provide additional detail. These are read-only completion indicators driven by the solved checkboxes, rather than draggable sliders that could overwrite question-level progress. Filtered lecture headers retain the full lecture's denominator. The collapsible course details summarize the learning structure without copying the original promotional text.
