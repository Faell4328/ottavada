**Why msgpack?** Because it is lighter and faster. If it were a configuration file that someone needs to read and change, it would make sense to be something like JSON, but it is something generated from computer to computer, so it is better to be a msgpack.

---

# Event Log (events.msgpack.zst)

Contains the system's incremental changes (insertions, updates and removals).

It is used for continuous synchronization between server and client, accumulating changes until they are consolidated into a snapshot. The client uses `last_change_timestamp` as a cursor; the `id` breaks ties between events with the same timestamp.

**Current flow:** server → client

---

# Snapshot (snapshot.msgpack.zst)

Contains the consolidated, published state of the catalog at a given moment (*checkpoint*).

The snapshot is intended for the Ottavada in **Consult** mode. It contains only songs with `main` status and scores with `main` status. `draft`, `ignored` data and `not_found` songs belong to the full backup of **Manage** mode, not to the client snapshot.

It is used for initialization and efficient synchronization of clients, avoiding the need to process the entire event history.

When connecting a new client, the expected flow is:

1. Load the `snapshot.msgpack.zst`;
2. Restore the consolidated state;
3. Apply only the events generated after the snapshot.

This process reduces synchronization time and avoids reading the entire *Event Log*.

**Flow:** server → client

---

# Database Export (backup.msgpack.zst)

Contains a complete export of the **Manage** mode database, including the records and states that are not published to clients.

The `draft` and `ignored` score files are kept separately in the score backup directory and are also part of the **Manage** mode backup flow.

It is used for backup, migration and replication between servers.

Unlike `snapshot.msgpack.zst`, `backup.msgpack.zst` has an administrative and persistence purpose, not operational synchronization.

**Flow:** server → server
