The Ottavada in **Manage** mode keeps all songs and scores in the local catalog. The status defines which data is published to the cloud provider and displayed by the Ottavada in **Consult** mode.

# Songs

- **Send allowed**: the song has at least one score with **Send allowed** status. Internally it uses `main` for this control.

- **Send not allowed**: it has no score with **Send allowed** status, but has at least one score with **Send not allowed** status. Internally it uses `draft` for this control.

- **No score**: the song has no available score. Internally it uses `not_found` for this control.

  - This happens when the song was previously indexed with scores, but for some reason the directory or files were not found.

## Observations

The **Send allowed** and **Send not allowed** statuses can be set manually or automatically, while the **No score** status is always automatic.

When the song status is changed manually, Ottavada propagates the change to all its scores, except scores with the ignored (`ignored`) status. An ignored score remains ignored until the user changes its status individually.

When a score's status is changed individually, the song's status is recalculated following the rules defined above.

---

# Scores

- **Send allowed**: they are sent to the cloud provider and become available to clients. Internally it uses `main` for this control.
- **Send not allowed**: they are not sent to the cloud provider. Internally it uses `draft` for this control.
- **Ignored**: it remains in the interface, but does not participate in the change verification nor is it sent to the cloud provider. Internally it uses `ignored` for this control. This status is not changed automatically when the song's status changes.

---

# In practice

- Songs with **send not allowed** or **no score** status are not made available to the client and are removed if they already exist there.

- Scores with **send not allowed** or **ignored** status are not sent to the client. If already present, they are also removed.

- When a score changes from **send allowed** to **send not allowed**, its previous **send allowed** version is not preserved, being removed from the cloud provider and, consequently, from the client.
