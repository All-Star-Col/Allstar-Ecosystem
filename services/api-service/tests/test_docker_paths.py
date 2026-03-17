import subprocess
import unittest
from pathlib import Path


class _ComposeValidationMixin:
    api_service_root: Path
    keys_dev_env_path: Path
    _created_keys_dev_env: bool

    @classmethod
    def _ensure_keys_dev_env(cls):
        cls._created_keys_dev_env = False
        if cls.keys_dev_env_path.exists():
            return

        cls.keys_dev_env_path.write_text("BW_ACCESS_TOKEN=dummy-token-for-tests\n")
        cls._created_keys_dev_env = True

    @classmethod
    def _cleanup_keys_dev_env(cls):
        if not getattr(cls, "_created_keys_dev_env", False):
            return
        if cls.keys_dev_env_path.exists():
            cls.keys_dev_env_path.unlink()

    def _run_compose_config_quiet(self):
        return subprocess.run(
            ["docker", "compose", "config", "--quiet"],
            cwd=self.api_service_root,
            capture_output=True,
            text=True,
            timeout=30,
        )


class TestDockerPathResolution(_ComposeValidationMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api_service_root = Path(
            "/home/automation/Documents/Allstar-Ecosystem/services/api-service"
        )
        cls.docker_compose_path = cls.api_service_root / "docker-compose.yml"
        cls.dockerfile_path = cls.api_service_root / "Dockerfile"
        cls.dockerfile_dev_path = cls.api_service_root / "Dockerfile.dev"
        cls.requirements_path = cls.api_service_root / "requirements.txt"
        cls.keys_dev_env_path = cls.api_service_root / "keys.dev.env"
        cls.src_dir = cls.api_service_root / "src"
        cls._ensure_keys_dev_env()

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_keys_dev_env()

    def test_docker_compose_file_exists(self):
        self.assertTrue(
            self.docker_compose_path.exists(),
            f"docker-compose.yml not found at {self.docker_compose_path}",
        )

    def test_dockerfile_exists(self):
        self.assertTrue(
            self.dockerfile_path.exists(),
            f"Dockerfile not found at {self.dockerfile_path}",
        )

    def test_dockerfile_dev_exists(self):
        self.assertTrue(
            self.dockerfile_dev_path.exists(),
            f"Dockerfile.dev not found at {self.dockerfile_dev_path}",
        )

    def test_requirements_txt_exists_for_docker(self):
        self.assertTrue(
            self.requirements_path.exists(),
            f"requirements.txt not found at {self.requirements_path}",
        )
        self.assertGreater(
            self.requirements_path.stat().st_size, 0, "requirements.txt is empty"
        )

    def test_keys_dev_env_exists_for_compose(self):
        self.assertTrue(
            self.keys_dev_env_path.exists(),
            f"keys.dev.env not found at {self.keys_dev_env_path}",
        )

    def test_src_directory_exists(self):
        self.assertTrue(
            self.src_dir.is_dir(), f"src/ directory not found at {self.src_dir}"
        )

    def test_docker_compose_config_parses_successfully_without_emitting_config(self):
        result = self._run_compose_config_quiet()
        self.assertEqual(
            result.returncode,
            0,
            "docker compose config --quiet failed",
        )

    def test_dockerfile_copy_requirements_instruction(self):
        content = self.dockerfile_path.read_text()
        self.assertIn(
            "COPY requirements.txt",
            content,
            "Dockerfile should contain 'COPY requirements.txt'",
        )
        self.assertTrue(
            self.requirements_path.exists(),
            "Dockerfile references requirements.txt but file does not exist in build context",
        )

    def test_dockerfile_copy_src_instruction(self):
        content = self.dockerfile_path.read_text()
        self.assertIn("COPY src", content, "Dockerfile should contain 'COPY src'")
        self.assertTrue(
            self.src_dir.is_dir(),
            "Dockerfile references src/ but directory does not exist in build context",
        )

    def test_docker_compose_env_file_points_to_keys_dev_env(self):
        compose_content = self.docker_compose_path.read_text()
        self.assertIn(
            "./keys.dev.env",
            compose_content,
            "docker-compose.yml should reference ./keys.dev.env",
        )
        self.assertTrue(
            self.keys_dev_env_path.exists(),
            f"docker-compose.yml references ./keys.dev.env but file does not exist at {self.keys_dev_env_path}",
        )

    def test_docker_compose_uses_dockerfile_dev(self):
        compose_content = self.docker_compose_path.read_text()
        self.assertIn(
            "Dockerfile.dev",
            compose_content,
            "docker-compose.yml should reference Dockerfile.dev for dev flow",
        )

    def test_docker_compose_volume_binds_src(self):
        compose_content = self.docker_compose_path.read_text()
        self.assertIn(
            "./src:/app/src",
            compose_content,
            "docker-compose.yml should contain './src:/app/src' volume binding",
        )


class TestDockerPathConsistency(_ComposeValidationMixin, unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api_service_root = Path(
            "/home/automation/Documents/Allstar-Ecosystem/services/api-service"
        )
        cls.docker_compose_path = cls.api_service_root / "docker-compose.yml"
        cls.keys_dev_env_path = cls.api_service_root / "keys.dev.env"
        cls._ensure_keys_dev_env()

    @classmethod
    def tearDownClass(cls):
        cls._cleanup_keys_dev_env()

    def test_build_context_matches_compose_context(self):
        compose_content = self.docker_compose_path.read_text()
        self.assertIn(
            "context: .",
            compose_content,
            "docker-compose.yml should use current directory as build context",
        )
        self.assertIn(
            "dockerfile: Dockerfile.dev",
            compose_content,
            "docker-compose.yml should use Dockerfile.dev in build section",
        )

    def test_compose_config_quiet_succeeds_with_dev_env_file(self):
        result = self._run_compose_config_quiet()
        self.assertEqual(
            result.returncode,
            0,
            "docker compose config --quiet failed",
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
