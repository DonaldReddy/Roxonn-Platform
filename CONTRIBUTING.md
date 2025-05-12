# Contributing to Roxonn

Thank you for your interest in contributing to Roxonn! We appreciate your help in building a decentralized future for software development.

## Licensing

Roxonn uses a **dual-license** model:

1.  **AGPL-3.0:** The core platform codebase is licensed under the [GNU Affero General Public License v3.0](LICENSE). This includes most files in the `client/`, `server/`, `contracts/`, and `shared/` directories. We welcome community contributions to these parts. By contributing to the AGPL-licensed code, you agree that your contributions will also be licensed under AGPL-3.0.
2.  **Roxonn Enterprise License:** Specific features intended for commercial offerings are located in directories named `ee/` or files containing `.ee.` in their name. This "Enterprise Code" is licensed under a separate commercial license, detailed in [LICENSE_EE.md](LICENSE_EE.md). Use of this code in production or commercial settings requires a valid license from Roxonn. Community contributions to the Enterprise Code are generally not accepted through public pull requests.

Please ensure you understand the implications of both licenses before contributing.

**Important Note on Contributions:**

*   **AGPL Core Contributions:** Pull Requests modifying code covered by the main [AGPL-3.0 License](LICENSE) (i.e., code *not* in `ee/` directories or marked with `.ee.`) are welcomed and follow the standard process outlined below. By submitting such a PR, you agree to license your contribution under AGPL-3.0.
*   **Enterprise Code (EE) Contributions:** Code within `ee/` directories or marked with `.ee.` is governed by the [Roxonn Enterprise License](LICENSE_EE.md). Contributions to this code require a specific Contributor Agreement assigning IP rights to Roxonn Future Tech Pvt. Ltd. Please see the "Contributor License Agreement (CLA)" section below for details on how all contributions are managed. Public PRs targeting EE code without a prior specific agreement cannot be merged.

## Getting Started

1.  **Prerequisites:** Make sure you have Docker and Node.js installed. See [README.md](README.md#getting-started) for details on the technology stack (primarily Node.js/TypeScript, React, Solidity, PostgreSQL).
2.  **Fork & Clone:** Fork the repository on GitHub and clone your fork locally.
3.  **Setup:** Follow the setup instructions in the [README.md](README.md#setting-up-the-project) (copy `.env.example`, run `make postgres`, `make install`).
4.  **Run Locally:** Start the development server using `make server`.

## How to Contribute

1.  **Find an Issue:** Look for issues tagged `help wanted` or `good first issue` in the GitHub repository, focusing on those related to the **AGPL Core**. We also run specific bounty programs via the Roxonn platform itself - check `app.roxonn.com` (link TBD) for active bounties (most public bounties will target the AGPL core).
2.  **Focus on AGPL Core:** Public contributions via Pull Requests should target the AGPL-licensed parts of the codebase.
3.  **Discuss:** If you plan to work on a significant change (even to AGPL code), please discuss it first by commenting on the relevant GitHub issue or creating a new one. For interest in EE features, contact us directly.
4.  **Develop:** Create a new branch for your changes (`git checkout -b feature/your-feature-name`). Make your code changes.
    *   **Coding Style & Linting:**
        *   We use **Prettier** for automatic code formatting. Please format your code before committing.
        *   **ESLint** is used for linting TypeScript/JavaScript code in the `client/` and `server/` directories.
        *   **Solhint** (typically integrated with Hardhat) is used for linting Solidity code in the `contracts/` directory.
        *   Please ensure your contributions pass all linter checks. Configuration files for these tools may be found in `package.json` or within specific project directories (e.g., `client/`, `server/`).
        *   We recommend installing editor extensions for Prettier and ESLint to get real-time feedback (e.g., "Prettier - Code formatter" and "ESLint" for VS Code).
5.  **Test:** Add relevant unit or integration tests for your changes. Ensure all tests pass (`npm run test`, `npx hardhat test`).
6.  **Submit Pull Request:** Push your branch to your fork and open a Pull Request against the main Roxonn repository.
    *   Clearly describe the changes you made and link the relevant GitHub issue(s).
    *   Ensure your PR passes all automated CI checks (linting, testing).
7.  **Review:** A core team member will review your PR, provide feedback, and potentially request changes.
8.  **Merge:** Once approved, your PR will be merged. Thank you for your contribution!

## Contributor License Agreement (CLA)

**All contributions** to the Roxonn project (including contributions to both AGPL and potential future contributions to EE code under specific agreements) require you to sign our Contributor License Agreement (CLA) before your first Pull Request can be merged.

The CLA grants Roxonn Future Tech Pvt. Ltd. the necessary rights to manage, relicense, and distribute your contributions as part of the project, including incorporating them into commercially licensed parts (EE code) if applicable and agreed upon separately. This ensures legal clarity for both contributors and users of the Roxonn platform.

We use **CLA Assistant** to manage our CLA signing process. When you submit your first Pull Request, the CLA Assistant bot will automatically add a comment to your PR prompting you to sign the CLA. You can sign the CLA directly within your PR by commenting:

```
I have read the CLA Document and I hereby sign the CLA
```

The CLA document is available at [CLA.md](CLA.md) in this repository.

Please ensure you have signed the CLA before submitting Pull Requests.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Questions?

Feel free to ask questions on the relevant GitHub issue or join our community channels (Links TBD - Discord, etc.).
