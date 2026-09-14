import numpy as np
import pytest

from simengine.twin.graph import CausalHealthGraph


def test_noisy_or_activation_increases_with_severity_and_activation_prob():
    low = CausalHealthGraph.noisy_or_activation_prob({"a": 0.1}, {"a": 0.8})
    high = CausalHealthGraph.noisy_or_activation_prob({"a": 0.9}, {"a": 0.8})
    assert high > low

    weak_cause = CausalHealthGraph.noisy_or_activation_prob({"a": 0.9}, {"a": 0.2})
    strong_cause = CausalHealthGraph.noisy_or_activation_prob({"a": 0.9}, {"a": 0.9})
    assert strong_cause > weak_cause


def test_backward_reasoning_favors_the_hypothesis_whose_observable_actually_moved():
    graph = CausalHealthGraph()
    # Hypothesis A's signature: obs_1 usually activates, obs_2 rarely does.
    # Hypothesis B's signature: the reverse.
    prob_given_A = {"obs_1": 0.9, "obs_2": 0.1}
    prob_given_B = {"obs_1": 0.1, "obs_2": 0.9}
    prob_given_null = {"obs_1": 0.05, "obs_2": 0.05}

    observed = {"obs_1": True, "obs_2": False}  # matches A's signature

    posterior_A = graph.hypothesis_posterior(0.5, observed, prob_given_A, prob_given_null)
    posterior_B = graph.hypothesis_posterior(0.5, observed, prob_given_B, prob_given_null)

    assert posterior_A > posterior_B
    assert posterior_A > 0.5


def test_forward_cascade_delay_matches_configured_lag():
    graph = CausalHealthGraph()
    for name, kind in [("cause", "component"), ("effect", "observable")]:
        graph.add_node(name, kind)
    lag_h = 2.0
    graph.add_edge("cause", "effect", gain=10.0, lag_h=lag_h)

    dt_h = 0.1
    result = graph.propagate({"cause": 1.0}, duration_h=5.0, dt_h=dt_h)

    time = result["time_h"]
    effect = result["effect"]
    # Before the lag elapses, "effect" should still be near sigmoid(0)=0.5
    # (no delayed cause value has arrived yet); once t > lag_h, it should
    # have risen sharply toward sigmoid(10*1.0) ~= 1.0.
    idx_before = np.searchsorted(time, lag_h - 0.5 * dt_h) - 1
    idx_after = np.searchsorted(time, lag_h + 0.5)
    assert effect[max(idx_before, 0)] < 0.6
    assert effect[idx_after] > 0.95


def test_counterfactual_projection_with_reduced_gain_slows_the_cascade():
    graph = CausalHealthGraph()
    for name, kind in [("cause", "component"), ("effect", "observable")]:
        graph.add_node(name, kind)
    graph.add_edge("cause", "effect", gain=8.0, lag_h=0.5)

    baseline = graph.propagate({"cause": 1.0}, duration_h=3.0, dt_h=0.1)
    counterfactual = graph.counterfactual_projection(
        {"cause": 1.0}, duration_h=3.0, dt_h=0.1, gain_overrides={("cause", "effect"): 1.0}
    )
    # A reduced edge gain (e.g. modeling a recommended power reduction) must
    # produce a LOWER projected severity at a fixed later time.
    idx = -1
    assert counterfactual["effect"][idx] < baseline["effect"][idx]
    # The override must not leak into the graph's stored state afterward.
    assert graph.edges[("cause", "effect")].gain == pytest.approx(8.0)


def test_maintenance_event_resets_edge_confidence_and_stops_blaming_replaced_component():
    graph = CausalHealthGraph()
    for name, kind in [("bearing", "component"), ("oil_pressure_residual", "observable")]:
        graph.add_node(name, kind)
    graph.add_edge("bearing", "oil_pressure_residual", gain=0.5, lag_h=0.5)

    # Simulate many observations reinforcing the bearing -> oil pressure link.
    for _ in range(20):
        graph.update_edge_confidence("bearing", "oil_pressure_residual", observed_effect=True)
    edge_before = graph.edges[("bearing", "oil_pressure_residual")]
    assert edge_before.alpha > 15.0  # strongly reinforced

    affected = graph.record_maintenance_event("bearing")
    assert "oil_pressure_residual" in affected
    edge_after = graph.edges[("bearing", "oil_pressure_residual")]
    assert edge_after.alpha == pytest.approx(1.0)
    assert edge_after.beta == pytest.approx(1.0)

    # Post-reset, the SAME single new observation should nudge the edge's
    # gain by much more than it would have before the reset (an
    # uninformative Beta(1,1) is far more sensitive to one new sample than
    # a Beta(21,1) posterior was) - this is the concrete sense in which the
    # graph "stops blaming a replaced part": one post-maintenance data point
    # can no longer be drowned out by 20 pre-maintenance ones.
    gain_after_reset_and_one_new_obs = (edge_after.alpha) / (edge_after.alpha + edge_after.beta)
    graph.update_edge_confidence("bearing", "oil_pressure_residual", observed_effect=False)
    edge_final = graph.edges[("bearing", "oil_pressure_residual")]
    shift = abs(edge_final.gain - gain_after_reset_and_one_new_obs)
    assert shift > 0.1
