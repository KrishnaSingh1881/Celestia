import numpy as np
import pytest

from simengine.twin.graph import CausalHealthGraph
from simengine.twin.health_index import (
    HealthIndex,
    channel_weights,
    graph_centrality,
    saturating_phi,
)


def _simple_weights():
    return {"CHT": 0.4, "oil_pressure": 0.35, "EGT": 0.25}


def test_saturating_phi_bounded_and_increasing():
    assert saturating_phi(0.0) == pytest.approx(0.0)
    assert 0.0 < saturating_phi(3.0) < 1.0
    assert saturating_phi(100.0) > 0.999
    assert saturating_phi(1.0) < saturating_phi(5.0)


def test_health_index_decreases_monotonically_as_any_channel_worsens():
    hi = HealthIndex(_simple_weights())
    z_base = {"CHT": 0.5, "oil_pressure": 0.2, "EGT": 0.1}
    base_score = hi.compute(z_base)

    for channel in z_base:
        z_worse = dict(z_base)
        z_worse[channel] = 6.0
        worse_score = hi.compute(z_worse)
        assert worse_score < base_score, f"HI did not fall when {channel} worsened"


def test_decompose_sums_back_to_the_total_deficit():
    hi = HealthIndex(_simple_weights())
    z = {"CHT": 2.5, "oil_pressure": -4.0, "EGT": 0.3}
    total_hi = hi.compute(z)
    contributions = hi.decompose(z)
    assert sum(contributions.values()) == pytest.approx(total_hi - 100.0, abs=1e-9)


def test_worst_channel_has_the_largest_magnitude_contribution():
    hi = HealthIndex(_simple_weights())
    z = {"CHT": 0.2, "oil_pressure": 5.0, "EGT": 0.1}
    contributions = hi.decompose(z)
    worst = min(contributions, key=contributions.get)  # most negative = worst
    assert worst == "oil_pressure"


def test_subsystem_index_isolated_from_other_channels():
    hi = HealthIndex(_simple_weights())
    z = {"CHT": 0.1, "oil_pressure": 6.0, "EGT": 0.1}
    thermal_index = hi.subsystem_index(z, ["CHT", "EGT"])
    assert thermal_index > 95.0  # thermal channels are healthy even though oil_pressure is not


def test_graph_centrality_ranks_a_hub_component_above_a_leaf():
    graph = CausalHealthGraph()
    for name, kind in [
        ("hub_component", "component"),
        ("leaf_component", "component"),
        ("obs_1", "observable"), ("obs_2", "observable"), ("obs_3", "observable"),
    ]:
        graph.add_node(name, kind)
    graph.add_edge("hub_component", "obs_1", gain=1.0, lag_h=0.1)
    graph.add_edge("hub_component", "obs_2", gain=1.0, lag_h=0.1)
    graph.add_edge("hub_component", "obs_3", gain=1.0, lag_h=0.1)
    graph.add_edge("leaf_component", "obs_1", gain=1.0, lag_h=0.1)

    centrality = graph_centrality(graph)
    assert centrality["hub_component"] > centrality["leaf_component"]


def test_channel_weights_come_from_centrality_times_consequence():
    centrality = {"a": 1.0, "b": 0.5}
    consequence = {"a": 1.0, "b": 1.0}
    weights = channel_weights(centrality, consequence)
    assert weights["a"] > weights["b"]
    assert sum(weights.values()) == pytest.approx(1.0)
