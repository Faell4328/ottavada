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

    let trailing_start = normalized
        .char_indices()
        .rev()
        .take_while(|(_, ch)| ch.is_ascii_digit())
        .map(|(idx, _)| idx)
        .last();

    let (base_raw, trailing_digits) = if let Some(start_idx) = trailing_start {
        (&normalized[..start_idx], &normalized[start_idx..])
    } else {
        (normalized.as_str(), "")
    };

    let base_without_numbers: String = base_raw.chars().filter(|ch| !ch.is_ascii_digit()).collect();
    let base = collapse_whitespace(&base_without_numbers);

    if base.is_empty() {
        return String::new();
    }

    if trailing_digits.is_empty() {
        base
    } else {
        format!("{} {}", base, trailing_digits)
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
    fn normalizes_score_name_without_middle_numbers() {
        assert_eq!(normalize_score_name("  Violino 2 Principal  "), "Violino Principal");
    }

    #[test]
    fn keeps_numbers_only_at_the_end() {
        assert_eq!(normalize_score_name(" 00001 Flauta 1 "), "Flauta 1");
        assert_eq!(normalize_score_name("Flauta 2 Principal 3"), "Flauta Principal 3");
        assert_eq!(normalize_score_name("Sax10"), "Sax 10");
    }

    #[test]
    fn returns_none_for_empty_optional_score_name() {
        assert_eq!(normalize_optional_score_name(Some(" 123 ")), None);
    }
}
