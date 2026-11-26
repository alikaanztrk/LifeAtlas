# LifeAtlas privacy notice

## Archive processing and storage

LifeAtlas reads the files you select directly in your browser. Import, analysis, edits and PNG generation run on your device. The app has no accounts, server-side archive storage, telemetry or remote geocoding.

The default **For this tab only** keeps the archive and its edits in memory. Closing or refreshing the tab clears them. If you choose **In this browser**, LifeAtlas saves normalized records and local edits in IndexedDB. The original import file stays on your device. Browser-profile storage is unencrypted by LifeAtlas, and browsers may evict it. Separate users or extensions with access to this profile may be able to inspect it.

**Data & privacy** lets you remove a saved archive or clear local archive data and display preferences. The clear-all action retains the offline application files and leaves the source JSON on your device. To remove the installed app and offline files as well, uninstall LifeAtlas if installed and clear site data in Chrome. Chrome manages site data at origin level, which may be shared with other projects of the same GitHub Pages account.

## App files and network requests

Live mode loads app files from the host. The host can see ordinary requests for those files. On a supported HTTPS or localhost production build, the service worker prepares a versioned cache of the app shell, scripts, styles, icons and notices. The cache contains neither archives nor tiles, requests with query strings, or exported images. Offline startup requires a successful initial download. Chrome may remove the cache when site data is cleared or evicted.

Strict privacy is the default. The optional OpenFreeMap basemap requires explicit permission for the current tab. Tile requests reveal the viewport region, zoom, IP address and timing to the tile provider. Revoking permission returns to the local map. Route playback also uses the local map. See the [OpenFreeMap project](https://openfreemap.org/quick_start/) for service and attribution details.

## Images you share

Rewind previews a PNG before you download it. You choose the aggregate fields and whether to include the month or year. The PNG excludes exact dates and times, locations, traces and place names. A coarse period and aggregate values can still be sensitive in combination. Review the preview before sending an image.
