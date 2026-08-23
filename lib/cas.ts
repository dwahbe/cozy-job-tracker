import { redis } from '@/lib/redis';

// Compares the stored blob's `version` with ARGV[1] and only then SETs ARGV[2]. A missing key or
// a blob without `version` counts as version 0, so existing documents migrate on their first write.
// Only the version is decoded server-side; the next value arrives already serialised by the
// client, byte-for-byte the way redis.set() would write it.
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local version = 0
if current then
  local decoded, doc = pcall(cjson.decode, current)
  if decoded and type(doc) == 'table' and doc.version ~= nil then
    version = tonumber(doc.version) or 0
  end
end
if version ~= tonumber(ARGV[1]) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

/** Write `next` to `key` only if the stored document is still at `expectedVersion`. */
export async function casSet(
  key: string,
  expectedVersion: number,
  next: unknown
): Promise<boolean> {
  const result = await redis.eval<[number, unknown], number | string>(
    CAS_SCRIPT,
    [key],
    [expectedVersion, next]
  );
  return Number(result) === 1;
}
