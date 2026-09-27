# OSS contribution orientation

Use CodeWiki to locate likely entry points, modules, behavior, and tests for the requested change. Select sections from their summaries, then read only those that help trace the relevant path. The wiki is an orientation aid; the repository checkout defines the code you can change.

If a checkout is available, compare the wiki's `commit` with the checkout revision. A different revision calls for checking the relevant code against the wiki before relying on its description. Read the repository's contribution instructions and the issue or request when available. Trace the affected behavior through source and existing tests, then choose the change location and a focused verification method from that evidence.

For an orientation request, return a concise map of likely files or modules, the relevant behavior path, and questions to resolve in source. For an implementation request, use that map to make and verify the requested change. Cite the CodeWiki repository, commit, and sections used for orientation; cite actual source paths for current implementation claims. Do not present wiki section anchors as source line references.
