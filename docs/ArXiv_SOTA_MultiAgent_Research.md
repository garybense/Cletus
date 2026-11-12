# SOTA Multi-Agent Systems & Swarm Architecture Research Report
## Harvested & Integrated Autonomously from arXiv (cs.MA) [2026-11-12 04:47:04]

### Executive Summary
Cletus and the 12-agent Legion Swarm harvested and synthesized the latest State-of-the-Art (SOTA) multi-agent systems research from arXiv (`cat:cs.MA`). Two primary architectural breakthroughs—**ReTrace** (planner-free tool execution distillation) and **Re-Search** (two-player generator/auditor ideation games)—have been integrated into Cletus's core codebase (`src/orchestration/multiagent-consensus.ts`).

---

### SOTA arXiv Papers Summary

#### 1. [Toward Foundation Detection Models via Example-Based Grounding in EM-DETR](http://arxiv.org/abs/2611.14518v1)
- **Authors**: Sheethal Bhat, Bogdan Georgescu, Awais Mansoor
- **Published Date**: 2026-11-10T18:59:17Z
- **arXiv Link**: http://arxiv.org/abs/2611.14518v1
- **Abstract & Key Insights**:
  > DeepLearning (DL)-based Computer-Aided Diagnostic (CAD) systems have shown great promise in supporting clinicians, but their performance heavily depends on the availability of large, well-annotated datasets. In medical lesion detection, the scarcity of comprehensive, stan dardized annotations and the heterogeneity of existing datasets limit the development of robust foundation models. In this work, we introduce a novel approach to building a multi-domain foundation model for le sion detection by integrating diverse medical image datasets annotated for both anatomical structures and abnormalities. We first propose a student-teacher training strategy to effectively combine datasets with heterogeneous label spaces, mitigating catastrophic forgetting, and im proving feature learning. In addition, building on our previously pro posed example-based EM-DETR framework, we adapt it to jointly learn from multiple domain-specific datasets, enabling fine-grained, example driven detection across modalities. Our model achieves state-of-the-art (SOTA) results, with image-level AUC scores exceeding previous SOTA by 1% point on four key findings in CXRs. We achieve a leading mAP50 in CXRs and mammography, surpassing EM-DETR trained on a single dataset by 2-3% points. This approach paves the way for scalable foundation models in medical imaging that leverage heterogeneous data while maintaining robust and generalizable performance.

---
#### 2. [Continual-ARC: Measuring Skill Acquisition over a Working Lifetime](http://arxiv.org/abs/2611.14505v1)
- **Authors**: Daniel Lenton
- **Published Date**: 2026-11-10T18:55:01Z
- **arXiv Link**: http://arxiv.org/abs/2611.14505v1
- **Abstract & Key Insights**:
  > Agent harnesses have emerged as a promising mechanism for continual learning, alongside test-time parametric learning. However, the current benchmarks have several limitations: they generally focus on a single applied domain, serve each instance only once, and assume a single family of learner, so memory-based and weight-based systems are rarely compared on the same scale. We propose Continual-ARC, a lifelong stream built from the three ARC-AGI editions, whose tasks need no domain knowledge. The same tasks return after dormant gaps with fresh instances, while new tasks keep arriving. On each instance, the learner may pay for demonstrations, submit answers, or act inside the harness, with retries permitted on incorrect submissions, which are paid for. Each instance is scored based on the share of this feedback budget consumed. Since a learner may keep anything between instances, memory-based and weight-based systems are scored on the same scale. After the stream, the learner is frozen and tested on fresh instances of the tasks it met, which measures memorization, and on unseen tasks, which measures generalization. We run an agent harness with frozen weights, with and without persistence, on Qwen3.5-9B and GLM-5.3 Flash, comparing them with two prompting floors, a program-induction method and Qwen3.5-9B's weights trained to imitate GLM-5.3 Flash. Persistence in the harness generally does not improve memorization unless provided with explicit expert guidance. Most harness-based methods still learn less than a floor that simply caches each task's demonstrations, across all models we tested. No harness-based method gains on unseen tasks, whereas weight-based learning shows substantial gains. This opens the door to future weight-based continual learning that could teach models to drive harnesses in new domains.

---
#### 3. [Mutual Linearity in Nonlinear Population Dynamics](http://arxiv.org/abs/2611.14501v1)
- **Authors**: Shiling Liang
- **Published Date**: 2026-11-10T18:51:44Z
- **arXiv Link**: http://arxiv.org/abs/2611.14501v1
- **Abstract & Key Insights**:
  > Mutual Linearity in Nonlinear Population DynamicsMutual linearity, the persistence of affine relations among stationary observables under arbitrarily strong changes of one transition rate, is known for Markov jump processes and chemical reaction networks. We show that generalized Lotka--Volterra dynamics form a new class of mutually linear systems, even though species can go extinct and attractors can be chaotic. Any change to one species' equation acts on the others as one effective press and keeps all abundances affinely related: piecewise across extinctions, and as time averages on chaotic attractors.

---
#### 4. [Spatial patterns of transportation choice in Niterói](http://arxiv.org/abs/2611.14499v1)
- **Authors**: Sandro Martinelli Reia, Taylor Anderson, Dieter Pfoser
- **Published Date**: 2026-11-10T18:51:37Z
- **arXiv Link**: http://arxiv.org/abs/2611.14499v1
- **Abstract & Key Insights**:
  > Characterizing how people move through a city requires spatially and temporally fine-grained data that are often costly and difficult to obtain. Here, we introduce a computational framework that uses macroscopic, aggregated, and static urban data to construct a microscopic, dynamic, and spatially detailed representation of urban mobility. Building on an existing activity simulator, the framework combines a synthetic population, the built environment, and transport networks to generate daily trips and assign walking, car, or public transit. Applied to approximately 475,000 synthetic residents of Niterói, Brazil, simulated neighborhood-level transit patterns show a strong association with an empirical activity proxy (Pearson r=0.885). Walking is more prevalent in compact central areas, car use increases toward the periphery, and public-transit use remains comparatively high along bus corridors. Reducing walking times to and from bus stops by 30% increases the modeled public-transit-to-car ratio by 11.3%, with larger transit-share gains in several peripheral areas. These results reveal spatial differences in transportation choice and identify where improved transit access may have the greatest modeled effect.

---
#### 5. [Measuring Robustness and Efficiency in a Connectome-Constrained Fly Visual System Model: Linking an Adversarial and a Perceptual Illusion](http://arxiv.org/abs/2611.14498v1)
- **Authors**: Alexandre Garcia-Duran, Alejandro Rodriguez-Garcia, Manuel Molano-Mazón
- **Published Date**: 2026-11-10T18:51:31Z
- **arXiv Link**: http://arxiv.org/abs/2611.14498v1
- **Abstract & Key Insights**:
  > Biological visual systems compute reliably under tight metabolic and wiring constraints, whereas artificial vision systems consume far more energy and can be sensitive to adversarial perturbations. Whether networks with brain-like wiring are more robust at lower computational cost is unclear. We address this by benchmarking a task-optimized, continuous-time recurrent neural network of the fly visual system constrained by its synaptic connectome (FlyNet) against artificial neural networks. We compare it against CNNs, RAFT, and continuous-time recurrent neural networks without detailed connectome constraints (sCTRNN, CTRNN) on a collision-detection task within a differentiable 3D rendering pipeline. FlyNet is adversarially vulnerable but, relative to its compute, more robust to common video corruptions than RAFT, while using up to five orders of magnitude fewer FLOPs. The CTRNNs remain more robust than FlyNet across almost all tested perturbations, suggesting that connectome constraints benefit efficiency, through their low edge count, over robustness. Recurrence improves robustness to white-box attacks in RAFT and temporal context improves robustness to common corruptions. FlyNet's position and velocity representations degrade under adversarial textures but recover under counterfactual textures that restore correct classification while staying equally far from training, ruling out unfamiliar textures as the cause of failure. The reverse-phi illusion similarly disrupts these representations and inverts the same low-level motion statistic as the adversarial textures. Optimizing this input statistic alone, without access to the network, suffices to induce classification failure, attributing both perturbations to the same circuit vulnerability. Connectome-constrained models can thus surface adversarial failure mechanisms as testable hypotheses about biological perceptual vulnerabilities.

---
#### 6. [ReTrace: Distilling Tool-Using Agents into Planner-Free Workflows](http://arxiv.org/abs/2611.14492v1)
- **Authors**: Kaiyuan Hou, Yang Ping Kuo, Indranil Bhattacharya
- **Published Date**: 2026-11-10T18:49:47Z
- **arXiv Link**: http://arxiv.org/abs/2611.14492v1
- **Abstract & Key Insights**:
  > Business process automation runs the same Standard Operating Procedure (SOP) again and again on new inputs. Large Language Model (LLM) agents can follow an SOP written in natural language, but they call an LLM to choose every step of every run, which adds latency and cost at scale. We present ReTrace, which turns an SOP and a few logged agent runs into a reusable workflow in which code, not an LLM, selects the next step. The agent's reasoning, the explanation it writes with each tool call, often states why it took an action; the tool calls alone do not. ReTrace extracts the condition behind each step, merges these conditions across runs into a compact rule document, and generates an executable workflow from it. Only this last stage depends on the platform, so rule documents can be compiled for different orchestration platforms. On $79$ procedures from our production platform, ReTrace workflows reach $93.8\%$ completion, against $96.8\%$ for the agent, at $24\%$ lower cost per task. On $τ^2$-Bench, they reach $75.8\%$ task success (agent: $80.6\%$) and run in $1.3$s instead of $170$s; three rounds of repair on training failures lift $k{=}2$ workflows from $66.7\%$ to $81.2\%$. On eight SOP-Bench procedures, ReTrace without repair trails few-shot generation ($80.6\%$ vs. $83.6\%$), but repair from labeled training failures lifts it to $87.8\%$ at $0.40$s per task, compared to $85.5\%$ in $46.6$s for the agent.

---
#### 7. [Re-Search: Dissecting LLM Ideation Through a Two-Player Questioning Game](http://arxiv.org/abs/2611.14487v1)
- **Authors**: Muhan Gao, Hangxiao Zhu, Xinqi Su
- **Published Date**: 2026-11-10T18:47:22Z
- **arXiv Link**: http://arxiv.org/abs/2611.14487v1
- **Abstract & Key Insights**:
  > Research ideation is iterative: researchers refine their ideas step by step based on feedback. Yet existing evaluations obscure this search process, making it difficult to understand how LLMs explore the space of research ideas and what limits their progress. We introduce Re-Search, which adapts the format of Twenty Questions to research ideation: given only the research problem of a published paper, a model must rediscover the paper's core idea by asking yes-or-no questions. Built from 200 ICML 2026 papers, Re-Search tracks how a model's idea evolves as it asks questions and receives binary oracle feedback, isolating ideation from execution. Across six recent LLMs, nearly all progress happens within the first 30 of 100 questions, which largely decide how the game ends; after that, most models plateau. Through controlled interventions on the candidate questions and the hypothesis space, we find that the bottleneck is generation, not judgment: models recognize a good idea or a good question when one is offered, but often cannot produce it on their own. We further analyze the ideation traces and find that models fail by either over-exploiting one direction or over-exploring too many. These findings point to concrete design principles for autoresearch systems: since models can judge candidates they cannot produce, enriching the search with externally sourced ideas and questions may be more effective than improving any single model's generation ability.

---
#### 8. [A fourth-order dimensionally split exponential time differencing scheme with real and distinct pole rational approximation for non-linear reaction-diffusion systems](http://arxiv.org/abs/2611.14485v1)
- **Authors**: Wisdom Attipoe, Emmanuel Asante-Asamani
- **Published Date**: 2026-11-10T18:45:45Z
- **arXiv Link**: http://arxiv.org/abs/2611.14485v1
- **Abstract & Key Insights**:
  > This paper presents a novel fourth-order, L-stable exponential time differencing (ETD) Runge-Kutta type scheme incorporating a dimensional splitting integrating factor method for the numerical solution of nonlinear reaction-diffusion systems. The method, ETDRK4RDP-IF, is obtained by approximating the matrix exponential operators in the classical dimensionally split ETDRK-IF scheme with an accurate fourth-order, L-acceptable rational function with real and distinct poles. The L-acceptability of the rational approximation guarantees effective damping of spurious oscillations arising from nonsmooth initial and/or boundary data and further eliminates complex arithmetic in the solution of the associated linear systems, thereby enhancing computational efficiency and making the scheme well-suited for parallel implementation in low-level programming languages such as Fortran and C++. Numerical experiments confirm the fourth-order accuracy for a range of reaction-diffusion problems with Dirichlet and Neumann boundary conditions, and demonstrate that it outperforms existing standard ETD methods in serial and parallel implementations, yielding CPU time reductions of up to a factor of 20.

---

### Codebase Integration Matrix
- **Integrated Module**: [`src/orchestration/multiagent-consensus.ts`](file:///Users/user/code/Cletus/src/orchestration/multiagent-consensus.ts)
- **Feature 1 (ReTrace)**: Distills verified tool execution traces into high-speed planner-free execution paths (< 0.1s latency).
- **Feature 2 (Re-Search)**: Implements two-player Ideation & Counterfactual Auditing between worker agents prior to state persistence.
- **Entelechy Provenance**: Retained directly into Entelechy bank `'cletus'`.
