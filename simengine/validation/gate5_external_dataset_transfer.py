"""Gate 5 - External dataset transfer (report section 18): validate the
vibration feature-extraction + classifier pipeline against a PUBLIC bearing-
fault/rotating-machinery dataset (e.g. the CWRU bearing dataset) independent
of this project's own simulated engine vibration, then apply the identical
pipeline to Phase 7's synthesized signals.

No such dataset is bundled with or reachable from this environment. Per the
roadmap's own Phase 10 instructions: implement the pipeline function (done -
see simengine.engine.vibration.extract_edge_features, Phase 7) and leave the
test marked skip with a clear description of what dataset it needs and where
to place it - do not fabricate a substitute "external" dataset to force a
pass.

To actually run this gate:
1. Download a public bearing-fault dataset (e.g. the CWRU Bearing Data
   Center dataset: https://engineering.case.edu/bearingdatacenter) as .mat
   or .csv files with known healthy/inner-race/outer-race/ball-fault labels
   and a known shaft speed per file.
2. Place the files under a local, gitignored directory, e.g.
   `simengine/validation/data/cwru/` (add that path to .gitignore).
3. Implement `_load_external_dataset()` below to read those files into
   (signal, fs_hz, shaft_freq_hz, label) tuples.
4. Remove the skip marker.
"""
import pathlib

import pytest

from simengine.engine.vibration import extract_edge_features  # noqa: F401 - the pipeline under test

EXTERNAL_DATASET_DIR = pathlib.Path(__file__).parent / "data" / "cwru"


def _load_external_dataset():
    raise NotImplementedError(
        "No external bearing-fault dataset is present. See this module's "
        "docstring for how to add one."
    )


@pytest.mark.skip(
    reason=(
        "requires a public bearing-fault dataset (e.g. CWRU) not present in this "
        "environment - see this file's module docstring for how to add one"
    )
)
def test_gate5_edge_feature_pipeline_discriminates_external_bearing_faults():
    dataset = _load_external_dataset()
    for signal, fs_hz, shaft_freq_hz, label in dataset:
        features = extract_edge_features(signal, fs_hz, shaft_freq_hz)
        assert features.shape == (21,)
    # A real implementation would train/evaluate a simple classifier on
    # `features` here and assert above-chance discrimination of `label`.
