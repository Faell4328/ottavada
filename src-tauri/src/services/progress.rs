use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum OperationKind {
    Decompress,
    MoveScores,
    GenerateArchives,
}

impl OperationKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            OperationKind::Decompress => "decompress",
            OperationKind::MoveScores => "move_scores",
            OperationKind::GenerateArchives => "generate_archives",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct OperationProgressSnapshot {
    pub active: bool,
    pub kind: Option<&'static str>,
    pub current: usize,
    pub total: usize,
}

impl Default for OperationProgressSnapshot {
    fn default() -> Self {
        Self {
            active: false,
            kind: None,
            current: 0,
            total: 0,
        }
    }
}

struct ProgressStore {
    snapshot: OperationProgressSnapshot,
}

impl ProgressStore {
    fn new() -> Self {
        Self {
            snapshot: OperationProgressSnapshot::default(),
        }
    }
}

fn store() -> &'static Mutex<ProgressStore> {
    static STORE: OnceLock<Mutex<ProgressStore>> = OnceLock::new();
    STORE.get_or_init(|| Mutex::new(ProgressStore::new()))
}

pub fn report_progress(kind: OperationKind, current: usize, total: usize) {
    let mut guard = store()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    guard.snapshot = OperationProgressSnapshot {
        active: true,
        kind: Some(kind.as_str()),
        current,
        total,
    };
}

pub fn finish_progress() {
    let mut guard = store()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    guard.snapshot = OperationProgressSnapshot::default();
}

pub fn snapshot() -> OperationProgressSnapshot {
    store()
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
        .snapshot
}

#[cfg(test)]
mod tests {
    use super::{
        finish_progress, report_progress, snapshot, OperationKind, OperationProgressSnapshot,
    };

    #[test]
    fn reports_active_progress_with_kind_and_counts() {
        finish_progress();
        report_progress(OperationKind::Decompress, 3, 10);

        let snap = snapshot();
        assert!(snap.active);
        assert_eq!(snap.kind, Some("decompress"));
        assert_eq!(snap.current, 3);
        assert_eq!(snap.total, 10);
    }

    #[test]
    fn finish_resets_to_inactive_default() {
        report_progress(OperationKind::MoveScores, 5, 5);
        finish_progress();

        let snap = snapshot();
        assert_eq!(
            snap,
            OperationProgressSnapshot {
                active: false,
                kind: None,
                current: 0,
                total: 0,
            }
        );
    }

    #[test]
    fn defaults_to_inactive_empty_state() {
        finish_progress();
        let snap = snapshot();
        assert!(!snap.active);
        assert_eq!(snap.kind, None);
        assert_eq!(snap.current, 0);
        assert_eq!(snap.total, 0);
    }
}