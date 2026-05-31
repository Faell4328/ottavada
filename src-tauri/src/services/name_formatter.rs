pub fn normalize_song_name(value: &str) -> String {
    collapse_whitespace(value).to_uppercase()
}

pub fn normalize_optional_score_name(value: Option<&str>) -> Option<String> {
    value
        .map(normalize_score_name)
        .filter(|normalized| !normalized.is_empty())
}

pub fn normalize_score_name(value: &str) -> String {
    let normalized = collapse_whitespace(value);
    if normalized.is_empty() {
        return String::new();
    }

    let start_idx = normalized
        .char_indices()
        .find(|(_, ch)| !ch.is_ascii_digit() && !ch.is_whitespace())
        .map(|(idx, _)| idx);

    match start_idx {
        Some(idx) => collapse_whitespace(&normalized[idx..]),
        None => String::new(),
    }
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::{normalize_optional_score_name, normalize_score_name, normalize_song_name};

    #[test]
    fn normalizes_song_name_to_uppercase() {
        assert_eq!(normalize_song_name("  canon in d  "), "CANON IN D");
    }

    #[test]
    fn removes_only_leading_numbers() {
        assert_eq!(normalize_score_name(" 00001 Flauta 1 "), "Flauta 1");
    }

    #[test]
    fn preserves_numbers_that_are_not_prefix() {
        assert_eq!(normalize_score_name("Trumpet 3I"), "Trumpet 3I");
        assert_eq!(
            normalize_score_name("Flauta 2 Principal 3"),
            "Flauta 2 Principal 3"
        );
        assert_eq!(normalize_score_name("Sax10"), "Sax10");
    }

    #[test]
    fn returns_none_for_empty_optional_score_name() {
        assert_eq!(normalize_optional_score_name(Some(" 123 ")), None);
    }
}
