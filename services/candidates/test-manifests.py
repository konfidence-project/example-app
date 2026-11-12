from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

import yaml


INSTANCE = "app.kubernetes.io/instance"
MANIFESTS = Path(__file__).resolve().parent / "manifests"


def render(suffix):
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        shutil.copytree(MANIFESTS, root / "base")
        subprocess.run(["kustomize", "edit", "set", "image",
                        "candidates=registry.example.com/candidates:test"], cwd=root / "base", check=True)
        overlay = root / "overlay"
        overlay.mkdir()
        (overlay / "kustomization.yaml").write_text(yaml.safe_dump({
            "apiVersion": "kustomize.config.k8s.io/v1beta1",
            "kind": "Kustomization",
            "resources": ["../base"],
            "namePrefix": "test-",
            "nameSuffix": suffix,
        }))
        output = subprocess.check_output(["kustomize", "build", str(overlay)], text=True)
        objects = {item["kind"]: item for item in yaml.safe_load_all(output)}
        return objects["Deployment"], objects["Service"]


def matches(selector, labels):
    return all(labels.get(key) == value for key, value in selector.items())


class ManifestTests(unittest.TestCase):
    def test_instance_tracks_rendered_deployment_name(self):
        for suffix in ("-0-1-0-test-hasha", "-0-1-0-test-hashb"):
            deployment, service = render(suffix)
            name = deployment["metadata"]["name"]
            labels = deployment["spec"]["template"]["metadata"]["labels"]
            self.assertEqual(service["spec"]["selector"][INSTANCE], name)
            self.assertEqual(deployment["spec"]["selector"]["matchLabels"][INSTANCE], name)
            self.assertEqual(labels[INSTANCE], name)
            self.assertEqual(labels["app"], "candidates")

    def test_services_exclude_other_instances_and_legacy_pods(self):
        first, first_service = render("-0-1-0-test-hasha")
        second, second_service = render("-0-1-0-test-hashb")
        first_labels = first["spec"]["template"]["metadata"]["labels"]
        second_labels = second["spec"]["template"]["metadata"]["labels"]
        self.assertTrue(matches(first["spec"]["selector"]["matchLabels"], first_labels))
        self.assertTrue(matches(second["spec"]["selector"]["matchLabels"], second_labels))
        self.assertTrue(matches(first_service["spec"]["selector"], first_labels))
        self.assertTrue(matches(second_service["spec"]["selector"], second_labels))
        self.assertFalse(matches(first_service["spec"]["selector"], second_labels))
        self.assertFalse(matches(second_service["spec"]["selector"], first_labels))
        self.assertFalse(matches(first_service["spec"]["selector"], {"app": "candidates"}))


if __name__ == "__main__":
    unittest.main()
