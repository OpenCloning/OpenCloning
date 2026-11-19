/**
 * A history file (cloning_strategy.json) with a single sequence from the database, as a DatabaseSource,
 * to load it with loadDatabaseFile. sequence is the text file sequence returned by the database.
 */
export default function databaseSequenceToHistoryFile(sequence, databaseId) {
  const source = { id: 1, input: [], database_id: databaseId, type: 'DatabaseSource' };
  const cloningStrategy = { sources: [source], sequences: [{ ...sequence, id: 1 }], primers: [] };
  return new File([JSON.stringify(cloningStrategy)], 'cloning_strategy.json', { type: 'application/json' });
}
