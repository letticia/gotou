// Keep in sync with the duplicated copy in public/sw.js (see that file's comment) —
// this module is the tested specification; sw.js is a static asset and can't import it.
const DICTIONARY_DATA_PATHS = ["/dictionary.sqlite3", "/dictionary-manifest.json"];

/** dictionaryStorage.ts が自前でCache APIを管理しているパスかどうか(Service Workerが素通りすべき対象) */
export function isDictionaryDataRequest(pathname: string): boolean {
  return DICTIONARY_DATA_PATHS.some(
    (path) => pathname === path || pathname.endsWith(path),
  );
}
