# 90-Day SOTA Multi-Agent Systems & Swarm Architecture Master Research Report
## Harvested & Integrated Autonomously from arXiv (cs.MA / cs.AI: Aug 2026 – Nov 2026) [2026-11-12 04:47:04]

### Executive Summary
Cletus and the 12-agent Legion Swarm completed a 90-day historical scan of State-of-the-Art (SOTA) multi-agent systems and agentic swarm papers on arXiv. Across 30 multi-agent publications from August 2026 through November 2026, three major architectural patterns emerged:

1. **ReTrace (Planner-Free Tool Execution Distillation)**: Caching verified multi-agent tool execution graphs to bypass redundant LLM planning turns (< 0.1s execution latency).
2. **Re-Search (Two-Player Generator/Auditor Ideation Games)**: Pairing worker agents into generator/auditor duos to counterfactually stress-test hypotheses before committing state.
3. **Dynamic Swarm Sub-Task Load Balancing**: Distributing high-dimensional task graphs dynamically across specialized model tiers based on token budgets and context window capacities.

---

### 📚 90-Day arXiv Multi-Agent Papers Directory

#### 1. [Toward Foundation Detection Models via Example-Based Grounding in EM-DETR](http://arxiv.org/abs/2611.14518v1)
- **Authors**: Sheethal Bhat, Bogdan Georgescu, Awais Mansoor
- **Published Date**: 2026-11-10T18:59:17Z
- **arXiv Link**: http://arxiv.org/abs/2611.14518v1
- **Abstract & Key Insights**:
  > DeepLearning (DL)-based Computer-Aided Diagnostic (CAD) systems have shown great promise in supporting clinicians, but their performance heavily depends on the availability of large, well-annotated datasets. In medical lesion detection, the scarcity of comprehensive, stan dardized annotations and the heterogeneity of existing datasets limit the development of robust foundation models. In this work, we introduce a novel approach to building a multi-domain foundation model for le sion detection by integrating diverse medical image datasets annotated for both anatomical structures and abnormalities. We first propose a student-teacher training strategy to effectively combine datasets with heterogeneous label spaces, mitigating catastrophic forgetting, and im proving feature learning. In addition, building on our previously pro posed example-based EM-DETR framework, we adapt it to jointly learn from multiple domain-specific datasets, enabling fine-grained, example driven detection across modalities. Our model achieves state-of-the-art (SOTA) results, with image-level AUC scores exceeding previous SOTA by 1% point on four key findings in CXRs. We achieve a leading mAP50 in CXRs and mammography, surpassing EM-DETR trained on a single dataset by 2-3% points. This approach paves the way for scalable foundation models in medical imaging that leverage heterogeneous data while maintaining robust and generalizable performance.

---
#### 2. [Contrastive Discovery: Open-Ended Scientific Discovery over Competing Explanations](http://arxiv.org/abs/2611.14514v1)
- **Authors**: Ziang Liu, James J. Kim, Yijia Dai
- **Published Date**: 2026-11-10T18:58:43Z
- **arXiv Link**: http://arxiv.org/abs/2611.14514v1
- **Abstract & Key Insights**:
  > LLM agents are increasingly used for open-ended, data-driven scientific discovery, yet most of them evaluate hypotheses pointwise, testing an empirical claim $h$ only against its complement $\neg h$. When evidence rejects $h$, the agent learns that one explanation is unlikely but not which alternative the evidence supports. To recover that alternative, we introduce Contrastive Discovery, which replaces the single hypothesis with a contrast set, a scientific question paired with mutually exclusive and collectively exhaustive competing explanations. Each experiment is scored by how its evidence redistributes belief across the set, and the question is resolved when belief concentrates on one explanation. Because contrast sets change only the unit an agent proposes and scores, an existing agent can use them to re-evaluate evidence it has already collected or to guide its search. Across six domains, $89\%$ of the pointwise candidates with the largest belief shifts are rejections. On the same evidence, contrast sets resolve $73\%$ of these candidates to a specific alternative. When contrast sets guide search, the agent resolves $67\%$ more questions than pointwise surprisal under the same experiment budget. In a blinded study, $38$ human experts chose the same explanation on $78\%$ of resolved questions and on $82\%$ of questions where the pointwise agent rejected its hypothesis and stopped. Together, these results support explicit competing explanations as a way for discovery agents to resolve more scientific questions from the same evidence and validation budget.

---
#### 3. [Pyrite: Building and Benchmarking Protein-Ligand Pose Ranking Agents](http://arxiv.org/abs/2611.14511v1)
- **Authors**: Megha Srivastava, Michael H. Lim, Allison M. Keys
- **Published Date**: 2026-11-10T18:56:32Z
- **arXiv Link**: http://arxiv.org/abs/2611.14511v1
- **Abstract & Key Insights**:
  > Predicting how a ligand binds to its target is central to small-molecule drug discovery. Modern cofolding models can generate diverse candidate poses, but reliably ranking these candidates remains challenging. We introduce Pyrite, a pairwise pose-ranking benchmark comprising 1,500 pose pairs across diverse protein-ligand complexes. Expert chemists equipped with 3D visualization tools and physics-based scores perform near chance, highlighting the difficulty of interpreting available chemical signals. To investigate automated ranking, we introduce PyriteRep, a structured representation of molecular geometry, protein-ligand interactions, and physicochemical scores, and develop two LLM-based agents: PyriteReasoner, which directly compares poses through text-based reasoning, and PyriteFeaturizer, which generates executable code to construct features for logistic regression, optionally incorporating features derived from LLM subcalls. These agents achieve up to 67% and 74% accuracy, respectively, exceeding observed expert performance. LLM-guided feature discovery generally outperforms direct reasoning, while Group Relative Policy Optimization (GRPO) improves open-weight models, enabling them to match or surpass closed-source frontier models in our evaluations. These results establish Pyrite as a challenging test of pose-ranking ability and highlight LLM-guided feature discovery as a promising approach to interpret and combine the outputs of computational chemistry tools.

---
#### 4. [Continual-ARC: Measuring Skill Acquisition over a Working Lifetime](http://arxiv.org/abs/2611.14505v1)
- **Authors**: Daniel Lenton
- **Published Date**: 2026-11-10T18:55:01Z
- **arXiv Link**: http://arxiv.org/abs/2611.14505v1
- **Abstract & Key Insights**:
  > Agent harnesses have emerged as a promising mechanism for continual learning, alongside test-time parametric learning. However, the current benchmarks have several limitations: they generally focus on a single applied domain, serve each instance only once, and assume a single family of learner, so memory-based and weight-based systems are rarely compared on the same scale. We propose Continual-ARC, a lifelong stream built from the three ARC-AGI editions, whose tasks need no domain knowledge. The same tasks return after dormant gaps with fresh instances, while new tasks keep arriving. On each instance, the learner may pay for demonstrations, submit answers, or act inside the harness, with retries permitted on incorrect submissions, which are paid for. Each instance is scored based on the share of this feedback budget consumed. Since a learner may keep anything between instances, memory-based and weight-based systems are scored on the same scale. After the stream, the learner is frozen and tested on fresh instances of the tasks it met, which measures memorization, and on unseen tasks, which measures generalization. We run an agent harness with frozen weights, with and without persistence, on Qwen3.5-9B and GLM-5.3 Flash, comparing them with two prompting floors, a program-induction method and Qwen3.5-9B's weights trained to imitate GLM-5.3 Flash. Persistence in the harness generally does not improve memorization unless provided with explicit expert guidance. Most harness-based methods still learn less than a floor that simply caches each task's demonstrations, across all models we tested. No harness-based method gains on unseen tasks, whereas weight-based learning shows substantial gains. This opens the door to future weight-based continual learning that could teach models to drive harnesses in new domains.

---
#### 5. [Mutual Linearity in Nonlinear Population Dynamics](http://arxiv.org/abs/2611.14501v1)
- **Authors**: Shiling Liang
- **Published Date**: 2026-11-10T18:51:44Z
- **arXiv Link**: http://arxiv.org/abs/2611.14501v1
- **Abstract & Key Insights**:
  > Mutual Linearity in Nonlinear Population DynamicsMutual linearity, the persistence of affine relations among stationary observables under arbitrarily strong changes of one transition rate, is known for Markov jump processes and chemical reaction networks. We show that generalized Lotka--Volterra dynamics form a new class of mutually linear systems, even though species can go extinct and attractors can be chaotic. Any change to one species' equation acts on the others as one effective press and keeps all abundances affinely related: piecewise across extinctions, and as time averages on chaotic attractors.

---
#### 6. [Spatial patterns of transportation choice in Niterói](http://arxiv.org/abs/2611.14499v1)
- **Authors**: Sandro Martinelli Reia, Taylor Anderson, Dieter Pfoser
- **Published Date**: 2026-11-10T18:51:37Z
- **arXiv Link**: http://arxiv.org/abs/2611.14499v1
- **Abstract & Key Insights**:
  > Characterizing how people move through a city requires spatially and temporally fine-grained data that are often costly and difficult to obtain. Here, we introduce a computational framework that uses macroscopic, aggregated, and static urban data to construct a microscopic, dynamic, and spatially detailed representation of urban mobility. Building on an existing activity simulator, the framework combines a synthetic population, the built environment, and transport networks to generate daily trips and assign walking, car, or public transit. Applied to approximately 475,000 synthetic residents of Niterói, Brazil, simulated neighborhood-level transit patterns show a strong association with an empirical activity proxy (Pearson r=0.885). Walking is more prevalent in compact central areas, car use increases toward the periphery, and public-transit use remains comparatively high along bus corridors. Reducing walking times to and from bus stops by 30% increases the modeled public-transit-to-car ratio by 11.3%, with larger transit-share gains in several peripheral areas. These results reveal spatial differences in transportation choice and identify where improved transit access may have the greatest modeled effect.

---
#### 7. [Measuring Robustness and Efficiency in a Connectome-Constrained Fly Visual System Model: Linking an Adversarial and a Perceptual Illusion](http://arxiv.org/abs/2611.14498v1)
- **Authors**: Alexandre Garcia-Duran, Alejandro Rodriguez-Garcia, Manuel Molano-Mazón
- **Published Date**: 2026-11-10T18:51:31Z
- **arXiv Link**: http://arxiv.org/abs/2611.14498v1
- **Abstract & Key Insights**:
  > Biological visual systems compute reliably under tight metabolic and wiring constraints, whereas artificial vision systems consume far more energy and can be sensitive to adversarial perturbations. Whether networks with brain-like wiring are more robust at lower computational cost is unclear. We address this by benchmarking a task-optimized, continuous-time recurrent neural network of the fly visual system constrained by its synaptic connectome (FlyNet) against artificial neural networks. We compare it against CNNs, RAFT, and continuous-time recurrent neural networks without detailed connectome constraints (sCTRNN, CTRNN) on a collision-detection task within a differentiable 3D rendering pipeline. FlyNet is adversarially vulnerable but, relative to its compute, more robust to common video corruptions than RAFT, while using up to five orders of magnitude fewer FLOPs. The CTRNNs remain more robust than FlyNet across almost all tested perturbations, suggesting that connectome constraints benefit efficiency, through their low edge count, over robustness. Recurrence improves robustness to white-box attacks in RAFT and temporal context improves robustness to common corruptions. FlyNet's position and velocity representations degrade under adversarial textures but recover under counterfactual textures that restore correct classification while staying equally far from training, ruling out unfamiliar textures as the cause of failure. The reverse-phi illusion similarly disrupts these representations and inverts the same low-level motion statistic as the adversarial textures. Optimizing this input statistic alone, without access to the network, suffices to induce classification failure, attributing both perturbations to the same circuit vulnerability. Connectome-constrained models can thus surface adversarial failure mechanisms as testable hypotheses about biological perceptual vulnerabilities.

---
#### 8. [Comparative Analysis of Agent Evaluation Frameworks: Stability, Detection, and Discovery in Enterprise Analytics Agents](http://arxiv.org/abs/2611.14493v1)
- **Authors**: Howard Zhang, Chuck Arvin, Logan Brown
- **Published Date**: 2026-11-10T18:50:06Z
- **arXiv Link**: http://arxiv.org/abs/2611.14493v1
- **Abstract & Key Insights**:
  > Deploying LLM-based analytics agents in enterprise settings requires evaluation frameworks that can reliably detect failures across complex, multi-tool workflows. We present a three-phase comparative study of three evaluation frameworks, each representing a distinct evaluation paradigm (trace-based LLM judging, text-only LLM judging with red-teaming, and deterministic heuristics), applied to two analytics agents in a controlled research setting using frozen execution traces. Phase 1 quantifies evaluation harness stability through repeated measurements, finding that 97% of configurations meet the stability threshold and that stability patterns are agent-independent. Phase 2 measures known risk detection on 72 ground-truth test cases, where the trace-based framework achieves the best precision-recall balance (F1=0.90) while text-only evaluation matches on recall but generates 5x more false alarms. Phase 3 evaluates unknown risk discovery, uncovering 24 novel failures with zero overlap between functional testing and security red-teaming. Our results demonstrate that (1) the information available to the evaluation harness determines evaluation quality, (2) functional and security evaluation are complementary, and (3) LLM-based evaluation harnesses surface subtle errors that human reviewers miss. We recommend a two-framework strategy: trace-based evaluation for functional assessment and adversarial red-teaming for security validation.

---
#### 9. [ReTrace: Distilling Tool-Using Agents into Planner-Free Workflows](http://arxiv.org/abs/2611.14492v1)
- **Authors**: Kaiyuan Hou, Yang Ping Kuo, Indranil Bhattacharya
- **Published Date**: 2026-11-10T18:49:47Z
- **arXiv Link**: http://arxiv.org/abs/2611.14492v1
- **Abstract & Key Insights**:
  > Business process automation runs the same Standard Operating Procedure (SOP) again and again on new inputs. Large Language Model (LLM) agents can follow an SOP written in natural language, but they call an LLM to choose every step of every run, which adds latency and cost at scale. We present ReTrace, which turns an SOP and a few logged agent runs into a reusable workflow in which code, not an LLM, selects the next step. The agent's reasoning, the explanation it writes with each tool call, often states why it took an action; the tool calls alone do not. ReTrace extracts the condition behind each step, merges these conditions across runs into a compact rule document, and generates an executable workflow from it. Only this last stage depends on the platform, so rule documents can be compiled for different orchestration platforms. On $79$ procedures from our production platform, ReTrace workflows reach $93.8\%$ completion, against $96.8\%$ for the agent, at $24\%$ lower cost per task. On $τ^2$-Bench, they reach $75.8\%$ task success (agent: $80.6\%$) and run in $1.3$s instead of $170$s; three rounds of repair on training failures lift $k{=}2$ workflows from $66.7\%$ to $81.2\%$. On eight SOP-Bench procedures, ReTrace without repair trails few-shot generation ($80.6\%$ vs. $83.6\%$), but repair from labeled training failures lifts it to $87.8\%$ at $0.40$s per task, compared to $85.5\%$ in $46.6$s for the agent.

---
#### 10. [Second-Best Trade Is Half Efficient in Multidimensional Markets](http://arxiv.org/abs/2611.14489v1)
- **Authors**: Dirk Bergemann, Yang Cai, Kangning Wang
- **Published Date**: 2026-11-10T18:48:40Z
- **arXiv Link**: http://arxiv.org/abs/2611.14489v1
- **Abstract & Key Insights**:
  > We prove that at least half of the first-best gains from trade can always be achieved in multidimensional two-sided markets with additive values and costs and arbitrary downward-closed feasibility constraints. The guarantee is achieved by a mechanism satisfying Bayesian incentive compatibility, interim individual rationality, and strong budget balance, and is tight already in single-item bilateral trade. Types are independent across agents, while the coordinates of each agent's type may be arbitrarily correlated. Feasibility constraints may couple trades across items and agents. This extends the known tight one-half guarantee for single-item bilateral trade.   Our proof develops a new application of the Cai--Devanur--Weinberg duality framework. We show that the objective of every feasible dual is at least half of the first best. Strong duality then yields the guarantee without characterizing an optimal mechanism or dual. The key observation is that every feasible dual induces continuous-time Markov chains that, when stopped by exponential clocks, recover true types as expectations of virtual types. The dual constraints control the rate at which these chains change the prior distributions. We establish our bound by combining this control with a coupling of the agents' clocks.

---
#### 11. [Re-Search: Dissecting LLM Ideation Through a Two-Player Questioning Game](http://arxiv.org/abs/2611.14487v1)
- **Authors**: Muhan Gao, Hangxiao Zhu, Xinqi Su
- **Published Date**: 2026-11-10T18:47:22Z
- **arXiv Link**: http://arxiv.org/abs/2611.14487v1
- **Abstract & Key Insights**:
  > Research ideation is iterative: researchers refine their ideas step by step based on feedback. Yet existing evaluations obscure this search process, making it difficult to understand how LLMs explore the space of research ideas and what limits their progress. We introduce Re-Search, which adapts the format of Twenty Questions to research ideation: given only the research problem of a published paper, a model must rediscover the paper's core idea by asking yes-or-no questions. Built from 200 ICML 2026 papers, Re-Search tracks how a model's idea evolves as it asks questions and receives binary oracle feedback, isolating ideation from execution. Across six recent LLMs, nearly all progress happens within the first 30 of 100 questions, which largely decide how the game ends; after that, most models plateau. Through controlled interventions on the candidate questions and the hypothesis space, we find that the bottleneck is generation, not judgment: models recognize a good idea or a good question when one is offered, but often cannot produce it on their own. We further analyze the ideation traces and find that models fail by either over-exploiting one direction or over-exploring too many. These findings point to concrete design principles for autoresearch systems: since models can judge candidates they cannot produce, enriching the search with externally sourced ideas and questions may be more effective than improving any single model's generation ability.

---
#### 12. [A fourth-order dimensionally split exponential time differencing scheme with real and distinct pole rational approximation for non-linear reaction-diffusion systems](http://arxiv.org/abs/2611.14485v1)
- **Authors**: Wisdom Attipoe, Emmanuel Asante-Asamani
- **Published Date**: 2026-11-10T18:45:45Z
- **arXiv Link**: http://arxiv.org/abs/2611.14485v1
- **Abstract & Key Insights**:
  > This paper presents a novel fourth-order, L-stable exponential time differencing (ETD) Runge-Kutta type scheme incorporating a dimensional splitting integrating factor method for the numerical solution of nonlinear reaction-diffusion systems. The method, ETDRK4RDP-IF, is obtained by approximating the matrix exponential operators in the classical dimensionally split ETDRK-IF scheme with an accurate fourth-order, L-acceptable rational function with real and distinct poles. The L-acceptability of the rational approximation guarantees effective damping of spurious oscillations arising from nonsmooth initial and/or boundary data and further eliminates complex arithmetic in the solution of the associated linear systems, thereby enhancing computational efficiency and making the scheme well-suited for parallel implementation in low-level programming languages such as Fortran and C++. Numerical experiments confirm the fourth-order accuracy for a range of reaction-diffusion problems with Dirichlet and Neumann boundary conditions, and demonstrate that it outperforms existing standard ETD methods in serial and parallel implementations, yielding CPU time reductions of up to a factor of 20.

---
#### 13. [Mechanistic Interpretability Needs a Logic of Inference](http://arxiv.org/abs/2611.14483v1)
- **Authors**: Zhimin Hu, Chen Jiang, Hanbo Xie
- **Published Date**: 2026-11-10T18:45:07Z
- **arXiv Link**: http://arxiv.org/abs/2611.14483v1
- **Abstract & Key Insights**:
  > Neural networks are increasingly studied not merely as predictive systems, but as complex systems whose internal computations are themselves objects of scientific inquiry. Recent progress in mechanistic interpretability (MI) has made it possible to identify neurons, features, circuits, population structures, and dynamical patterns associated with model behavior. As these tools improve, attention is shifting from what can be observed inside a model to how those observations support mechanistic explanations. We examine the parallel efforts of neuroscience and MI to address this question and identify recurring inferential bottlenecks when inferring mechanisms from complex neural systems. We propose five principles and organize them into a recursive logic for a more rigorous procedure of mechanistic inference. These principles provide a framework that supports scientific discovery in two senses: it helps turn local interpretability findings into cumulative knowledge of mechanisms within models, and it makes those mechanisms sufficiently precise to generate testable hypotheses about domains beyond the models. Evidence beyond MI is ultimately required to establish what model mechanisms reveal about the world.

---
#### 14. [Pterodactyl: Pushing the Limits of Efficient Automated Translation Evaluation](http://arxiv.org/abs/2611.14480v1)
- **Authors**: Evelyn Y. Garland, Carola F. Berger
- **Published Date**: 2026-11-10T18:41:37Z
- **arXiv Link**: http://arxiv.org/abs/2611.14480v1
- **Abstract & Key Insights**:
  > In this paper, we present 1020 Group's submission to the WMT26 shared task on automated quality evaluation. Our system, Pterodactyl, was engineered specifically for subtasks 2 and 3, that is, segment-level quality score prediction and the detection of error-free segments. Pterodactyl is a highly customizable, ultra-low cost system optimized for binary classification in translation triage and data curation. It is based on an LLM-as-a-judge approach, with prompt engineering and model selection guided by ROC analysis. We also developed several variants of Pterodactyl that were specifically adapted for subtasks 3.

---
#### 15. [FERN: Cross-Benchmark Table Retrieval for Text-to-SQL with Frozen Retrievers and Learned Ranking](http://arxiv.org/abs/2611.14477v1)
- **Authors**: Arjun Rao, Nishant Gopinath
- **Published Date**: 2026-11-10T18:39:49Z
- **arXiv Link**: http://arxiv.org/abs/2611.14477v1
- **Abstract & Key Insights**:
  > Text-to-SQL systems over large pooled catalogs must first retrieve the tables a question needs. We compare against the published table recall of RASL, which uses Claude 3.5 models to extract keywords and select tables, on pooled BIRD, Spider, and Fiben catalogs. FERN (Feature-Engineered Ranking with No generative LLM) instead fuses three frozen retrievers into 100 candidates, describes each with up to 120 features, and reorders them with LightGBM rankers fitted once on BIRD's training questions. On Spider, where it was not fitted, its candidate pool alone reaches RASL's published recall at fifteen tables (98.0), and the ranker raises the share of questions with every gold table in the top five (complete@5) from 83.9% to 95.6%. At five tables, FERN's recall is within one point of RASL's on Spider (96.7 vs 97.0) and on BIRD with its evidence hints (96.6 vs 97.5), and 8.2 points below on BIRD without them (89.3). On 121 real BEAVER questions, without BEAVER fitting, its recall at fifteen (82.1) falls between two BEAVER-trained retrievers (80.8, 84.5), but its complete@15 is below both (49.6 vs 54.5 and 62.0). On Fiben, it falls far short at fifteen tables (54.2 vs 69.2, different question sets), although its recall at fifty is numerically close to RASL's question-only retrieval result (80.7 vs 79.4). On BIRD dev with evidence, non-retrieval features raise complete@5 by 7.7 points over retrieval signals alone. On BIRD dev, median latency is 208 ms per question on one A100, without hosted model calls.

---
#### 16. [Thin-film lithium niobate integrated photonics at 493 nm](http://arxiv.org/abs/2611.14474v1)
- **Authors**: Nicholas Achuthan, Letícia Magalhães, Xudong Li
- **Published Date**: 2026-11-10T18:37:35Z
- **arXiv Link**: http://arxiv.org/abs/2611.14474v1
- **Abstract & Key Insights**:
  > Visible and near-ultraviolet light underpins applications from biophotonics to quantum computing, which demand fast control of optical amplitude and phase. Integrated photonics offers scalable control, yet most visible-wavelength platforms lack gigahertz-scale modulation. We demonstrate a thin-film lithium niobate platform at 493 nm integrating grating couplers, beamsplitters, ring resonators, and modulators. Segmented traveling-wave modulators achieve a half-wave voltage--length product of 450 mV$\cdot$cm, $>$20 dB extinction, and bandwidth beyond 50 GHz. Ring resonators show $2.9 \pm 0.2$ dB/cm propagation loss and quantify the platform's photorefractive response. This enables agile visible beam delivery for trapped-ion systems, although photorefraction and substrate uniformity remain key challenges to scaling.

---
#### 17. [TanCRAFT: Context-Reasoned Anticipatory Feedback for Assembly Tasks](http://arxiv.org/abs/2611.14470v1)
- **Authors**: Sassan Mokhtar, Lars Doorenbos, Marius Bock
- **Published Date**: 2026-11-10T18:33:53Z
- **arXiv Link**: http://arxiv.org/abs/2611.14470v1
- **Abstract & Key Insights**:
  > Preventing human error in physical assembly tasks requires assistance systems that can intervene before mistakes are made. This is especially challenging in settings where users are free to choose the construction order and correctness depends on the evolving assembly rather than a fixed next step. We present TanCRAFT, a four-stage real-time predictive assistance system that tracks the scene state, reasons about the current partial assembly, forecasts the near-future motion of manipulated pieces, and intervenes when the predicted placement is incompatible with the target. We instantiate our framework and confirm its effectiveness in a controlled tangram assembly task through offline benchmarks and a within-subject user study. Our findings show that the predictive feedback significantly reduces mistakes relative to unguided and reactive sessions, while yielding the lowest mean perceived workload and shortest mean completion time. Overall, these results demonstrate the value of predictive feedback for error prevention and provide a step toward cost-aware assistance for automation and human-robot workcells.

---
#### 18. [Bayesian inverse problems and epidemic-threshold uncertainty for a heterogeneous SIS reaction-diffusion model](http://arxiv.org/abs/2611.14468v1)
- **Authors**: Duc-Lam Duong
- **Published Date**: 2026-11-10T18:32:19Z
- **arXiv Link**: http://arxiv.org/abs/2611.14468v1
- **Abstract & Key Insights**:
  > We study Bayesian inference of persistence from early observations of a heterogeneous susceptible--infected--susceptible (SIS) reaction--diffusion model with standard incidence. We show that the leading prevalence dynamics depend on the unknown coefficients only through the difference between the transmission and recovery rates and the infected diffusivity. The same pair determines the principal eigenvalue whose sign governs persistence, so early prevalence can inform the threshold even when the individual rates remain uncertain. We prove global weak well-posedness and quantitative parameter stability for the SIS system and use the resulting observation-map estimates to establish Bayesian well-posedness. For an initial infection of size $\varepsilon$, we derive a uniform second-order expansion that describes how the separate rates enter prevalence. Incidence depends explicitly on transmission at leading order. When the noise standard deviation is proportional to $\varepsilon$, we prove $O(\varepsilon)$ convergence in Hellinger distance of the nonlinear posteriors to their low-prevalence limits for both prevalence alone and joint prevalence and incidence data. We bound the principal eigenvalue using the growth rate of the infected $L^2$ norm between two times. This rate gives a lower bound for the full nonlinear system, and the upper bound separates spatial transients from nonlinear saturation. Uniform spectral estimates and bounds on infection size and measurement error give sufficient conditions for persistence and extinction. We also bound the error in posterior persistence probabilities under forward and eigenvalue approximation, accounting for posterior mass near the threshold. Numerical examples illustrate threshold inference and the predicted \(O(\varepsilon)\) convergence of the nonlinear posteriors to their low-prevalence limits in Hellinger distance.

---
#### 19. [Newton non-degenerate holomorphic foliations and their separatrices](http://arxiv.org/abs/2611.14466v1)
- **Authors**: Arturo Fernández-Pérez, Evelia R. García Barroso, Rogério Mol
- **Published Date**: 2026-11-10T18:31:26Z
- **arXiv Link**: http://arxiv.org/abs/2611.14466v1
- **Abstract & Key Insights**:
  > In this paper we study germs of holomorphic foliations in the complex plane that are Newton non-degenerate. This is an algebraic condition attached to the Newton polygon of the foliation, analogous to the one defined by Kouchnirenko for analytic curves and, more generally, hypersurfaces. As in this case, the condition of Newton non-degeneracy for foliations can be identified through the comparison of two numerical invariants: the Newton number - a computation involving simple geometric data of the Newton polygon - and the Milnor number. The Newton number is never greater than the Milnor number, and the foliation is Newton non-degenerate if and only if they are equal. The assumption that a foliation is Newton non-degenerate imposes conditions on its set of separatrices. We prove that, under this hypothesis, the foliation has no weak separatrices and, hence, all its separatrices are analytic. We also give a description of the set of separatrices of a Newton non-degenerate foliation, which is sufficient to characterize the foliation as Newton non-degenerate when it is of generalized curve type. This allows us to prove that the property of being Newton non-degenerate is topologically invariant for foliations of generalized curve type.

---
#### 20. [Structure of correlations for the single-$j$ model using quantum information theory](http://arxiv.org/abs/2611.14460v1)
- **Authors**: Javier Faba, Vicente Martín, Luis Robledo
- **Published Date**: 2026-11-10T18:28:52Z
- **arXiv Link**: http://arxiv.org/abs/2611.14460v1
- **Abstract & Key Insights**:
  > We say that a system undergoes a quantum phase transition when the mean-field ground state of a given Hamiltonian spontaneously breaks its symmetries depending on the Hamiltonian parameters. It is a widely accepted view that this phenomenon enables the mean-field state to absorb the maximum amount of correlations without losing its mean-field structure. However, it is still uncertain how those correlations are incorporated within the mean-field state and how the correlation structure changes when we get closer to the exact ground state by restoring the symmetries. In this work, we answer these questions by studying the single-$j$ model, which is a realistic fermionic nuclear model with abelian and non-abelian broken symmetries. We find that both types of symmetries have very different effects for the correlations within the mean-field state. This makes unclear the concept of the symmetry breaking process as a mechanism to absorb the maximum amount of correlations. Moreover, the symmetry restoration redistributes existing `fake' correlations between paired orbitals to more complex subsystems.

---
#### 21. [Quantum Thermal Transistor via Nonlinear Environmental Coupling](http://arxiv.org/abs/2611.14458v1)
- **Authors**: Laiba Hayat, M. Tahir Naseem
- **Published Date**: 2026-11-10T18:26:46Z
- **arXiv Link**: http://arxiv.org/abs/2611.14458v1
- **Abstract & Key Insights**:
  > Thermal amplification enables sensitive control of heat currents, providing a basis for heat management and thermal signal processing in quantum devices. For a harmonic oscillator coupled to emitter, collector, and base thermal reservoirs, we recover the absence of thermal amplification when system-reservoir interactions permit only single-quantum exchange. A controlled weak-nonlinearity expansion, supported by numerical stationary solutions, shows that two-quantum exchange at the emitter enables amplification and predicts its onset. When two-quantum exchange dominates at the emitter and collector, varying the base temperature redistributes populations between even and odd oscillator sectors. This changes the emitter and collector heat currents far more than the base current, enabling large thermal amplification. We propose a realization using a longitudinally coupled auxiliary two-level system and bath spectral filtering, specifying conditions for its elimination to yield the required oscillator dynamics. These results establish nonlinear system-reservoir coupling as a resource for controlling heat flow and enabling thermal amplification.

---
#### 22. [Dimensional Crossover and Correlated Spin Dynamics in the Chain-Like van der Waals Antiferromagnet AgCrP$_2$S$_6$](http://arxiv.org/abs/2611.14444v1)
- **Authors**: C. S. Saramgi, Y. Shemerliuk, S. Selter
- **Published Date**: 2026-11-10T18:14:07Z
- **arXiv Link**: http://arxiv.org/abs/2611.14444v1
- **Abstract & Key Insights**:
  > We report a comprehensive investigation of the magnetic properties and spin dynamics of the chain-like van der Waals antiferromagnet AgCrP$_2$S$_6$ using magnetization, magnetic susceptibility, and $^{31}$P nuclear magnetic resonance (NMR). The magnetic susceptibility exhibits a broad maximum near 250 K, characteristic of strong short-range antiferromagnetic correlations in a low-dimensional system. A classical Fisher-chain analysis gives an effective intrachain exchange scale $J/k_B\approx 140$ K, while a quantum $S=3/2$ nearest-neighbor-chain calculation yields $J/k_B\approx 114$ K. A constrained AF-FM zig-zag-chain calculation is also compatible with the susceptibility, supporting a dominant quasi one dimensional antiferromagnetic exchange scale of order 100 K.   $^{31}$P NMR measurements provide microscopic insight into both static and dynamic spin correlations. The $K-χ$ relation displays two distinct linear regimes separated near $T^\ast\approx 250$ K, with different slopes indicating a change in the effective transferred hyperfine couplings. Below $T_{N}$, the relaxation follows $1/T_1\propto T^5$, consistent with magnon-mediated relaxation in the ordered state. The temperature dependence of the internal hyperfine field yields a critical exponent $β\approx 0.36$, consistent with three-dimensional universality.   Together, these results establish AgCrP$_2$S$_6$ as a quasi-one-dimensional $S=3/2$ antiferromagnet embedded in a layered van der Waals host, in which local probes directly resolve the crossover from correlated intrachain spin dynamics to anisotropic three-dimensional magnetic order. More broadly, AgCrP$_2$S$_6$ provides a useful van der Waals platform for studying dimensional crossover, correlated spin dynamics, and hyperfine-coupling evolution in low-dimensional antiferromagnets.

---
#### 23. [Assessing Alignment in Automatic Piano Transcription Datasets: A Benchmark for Scoring Methods](http://arxiv.org/abs/2611.14443v1)
- **Authors**: Lucas de Souza Brandão, Lucas Gris, Joaquim Cavalcante
- **Published Date**: 2026-11-10T18:13:47Z
- **arXiv Link**: http://arxiv.org/abs/2611.14443v1
- **Abstract & Key Insights**:
  > Automatic Music Transcription (AMT) relies on paired audio--MIDI datasets, implicitly assuming near-perfect temporal alignment. However, widely used piano datasets have been shown to contain alignment errors that may bias model evaluation and training. We propose a framework for evaluating audio--MIDI alignment scoring methods through controlled temporal, pitch, and structural MIDI corruptions. We also introduce STI, a scoring method built on AMT models, and benchmark it against existing alignment scoring approaches. Our results show that STI, together with methods based on CENS and spectrograms, achieves the strongest overall performance, with STI exhibiting the highest sensitivity to fine-grained temporal misalignments, the main alignment error in AMT datasets. We then apply the best-performing methods to widely used piano AMT datasets and identify trends in their relative alignment quality. These results support more informed dataset curation, model training, and AMT evaluation.

---
#### 24. [Cascading Contingency Analysis of Modern Power Systems Using a Stochastic Hybrid Systems Framework](http://arxiv.org/abs/2611.14439v1)
- **Authors**: Masoud H. Nazari, Hamid Varmazyari
- **Published Date**: 2026-11-10T18:11:28Z
- **arXiv Link**: http://arxiv.org/abs/2611.14439v1
- **Abstract & Key Insights**:
  > This paper presents a cascading contingency analysis and risk assessment framework that incorporates probabilistic mode transitions motivated by stochastic hybrid system (SHS) concepts together with power-flow-based stress evaluation. A two-stage modeling approach is adopted in which sensitivity-based analysis is first used to identify candidate cascading transitions, followed by DC power flow re-evaluation to accurately capture post-contingency stress redistribution, islanding behavior, and load shedding. A probabilistic propagation model is constructed using mode-dependent transition probabilities derived from line loading conditions. A Cascading Risk Index (CRI) is introduced to quantify the expected load shedding accumulated over cascade progression. Case studies on the IEEE 39-bus system demonstrate that the proposed framework captures diverse cascading routes under multiple initiating outages and identifies critical propagation patterns that are not revealed by N-1/N-2 screening. The results highlight the importance of SHS modeling in assessing cascading risk and providing a scalable framework for resilience evaluation in modern power systems.

---
#### 25. [One Policy for 100 Household Tasks: Our Solution for the 2026 BEHAVIOR Challenge](http://arxiv.org/abs/2611.14432v1)
- **Authors**: Ilia Larchenko, Gleb Zarin, Atindra Nair
- **Published Date**: 2026-11-10T18:06:16Z
- **arXiv Link**: http://arxiv.org/abs/2611.14432v1
- **Abstract & Key Insights**:
  > We describe our solution for the 2026 BEHAVIOR Challenge: 100 long-horizon household tasks in the OmniGibson simulator. We placed 9th on the final leaderboard, the only independent team in the top 10. The core of the solution is a single vision-language-action (VLA) model, one checkpoint for all 100 tasks, built on our 1st-place 2025 solution, which is based on $π_{0.5}$. On the 50 tasks shared with 2025, its Q rises from 0.260 to 0.371; across all 100 tasks it scores 0.392. Our main conclusion from 2025 was that the model was undertrained, so most of the 2026 work went into training the model for longer, optimizing some training parameters, making each training step slightly faster and reducing the gradient noise: a migration from 50 to 100 tasks (semantic stages built from the demonstrations' skill annotations, task and stage embeddings of new tasks warm-started from similar old ones, and a 21-dimensional action space matching the teleoperation controls); variance-reduced multi-sample flow matching with a simple noise-vs-compute model that picks the number of action-expert samples per observation without ablations; and a 200k-step training run, about one pass over the 211M frames of the demonstrations. A cloud evaluation infrastructure keeps a shared record with provenance, episode diagnostics and restorable simulator states, and runs six simulators on one GPU together faster than real time. On top of the learned policy, 14 tasks are routed to a GPT-6 Astra coding agent that controls the robot through observation and motion tools, starting every episode from a frozen copy of its own practice session on training instances. Across these 14 tasks, Astra's mean Q is 0.639, against 0.108 for the learned policy. The public submission included only part of the Astra results and scored 0.446 Q with 27.3% full-task success.

---
#### 26. [Demonstration of MANA: Multi-perspective Alignment of NPC Agents](http://arxiv.org/abs/2611.14431v1)
- **Authors**: Amir Tahmasbi, Keshav Singh, Shaheer Raza
- **Published Date**: 2026-11-10T18:05:42Z
- **arXiv Link**: http://arxiv.org/abs/2611.14431v1
- **Abstract & Key Insights**:
  > We present MANA (Multi-perspective Alignment of NPC Agents), an interactive approach for authoring NPC behavior through embodied demonstration. We show MANA in the context of Minecraft, where a developer aligns NPCs while playing the game itself. Activating MANA lets the developer dynamically switch into the point of view (POV) of any character and demonstrate, in-situ, how it would act given the surrounding context, through both movement and dialogue. MANA then distills each demonstration into a generalized policy that maps in-game context to actions. Finally, once the developer switches to another NPC or exits MANA mode, this generalized policy drives the NPC on its own. We demonstrate MANA by aligning two initially generic Minecraft NPCs: Fletcher and Farmer to act aggressively and cowardly, respectively. After roughly 2 minutes of in-game play, each character exhibits consistent and believable behaviors across new, unseen scenarios.

---
#### 27. [Earlybird: Predictive Streaming Speech Recognition in 29M Parameters](http://arxiv.org/abs/2611.14421v1)
- **Authors**: Sahil Mahendrakar
- **Published Date**: 2026-11-10T17:59:28Z
- **arXiv Link**: http://arxiv.org/abs/2611.14421v1
- **Abstract & Key Insights**:
  > Streaming speech recognizers output a word only after the speaker has finished it, typically 90-400 ms later. For a voice agent every millisecond counts: the sooner the words are outputted, the sooner the agent can start a search or plan its reply. We present Earlybird, a 29M-parameter streaming recognizer (16.8 MB at 4 bits). Earlybird learns from audio cut off at random points, including partway through a word, and is asked to predict every word that is due by then in full, plus a guess of the next two words. Its raw token probabilities give a confidence for every word including the one still being spoken. On clean audiobook speech (LibriSpeech test-clean), the median word is predicted correctly 90 ms before the speaker finishes it, while released streaming models get it 90 to 400 ms after it ends. Earlybird is the earliest on all six test sets we time, covering audiobooks, TED talks, public speech, earnings calls, and synthetic speech. On the same audiobooks, 69% of words are predicted correctly before they end, against 3-25% for the other models. For words still being spoken, confidence is calibrated, with an expected calibration error (ECE) of 3.7 to 5.5. On the eight English Open ASR Leaderboard sets, it is more accurate than Moonshine Tiny on every set and roughly ties Whistle, a model of the same size.

---
#### 28. [Evaluating LLM-Generated World Models for Neuro-Symbolic Reasoning](http://arxiv.org/abs/2611.14419v1)
- **Authors**: Souhaila Djaffal, Amna Jamal, Gagana Madhugiri Devaraja
- **Published Date**: 2026-11-10T17:58:12Z
- **arXiv Link**: http://arxiv.org/abs/2611.14419v1
- **Abstract & Key Insights**:
  > Formal world models can support planning, verification, and safety reasoning, but constructing them from open-ended natural-language situations is difficult, particularly in multi-agent settings where several formalizations may be plausible. We study whether five LLMs can generate such world models as partially observable stochastic games and whether mechanical validity is sufficient to establish that the resulting model faithfully represents the intended decision problem. We introduce a benchmark of 44 scenarios spanning game, situational, and cultural settings and evaluate generated world models along three dimensions: mechanical validity, reference-relative structural agreement, and semantic criteria. Across three empirical tracks, we analyze 410 first-pass generations. In the reference-backed game track, 134/135 generated world models pass a strict mechanical audit, yet mean permutation-invariant structural F1 is only 0.366, with just 28/134 mechanically valid models exactly matching the authored reference. In the cultural track, explicitly naming the country changes the generated structural representation for most LLMs while producing only small changes in automated semantic scores. These results show that executability is a necessary but insufficient criterion for LLM-generated world models: models that are mechanically valid can still differ substantially in the structure used by downstream neuro-symbolic reasoning and planning.

---
#### 29. [Analysis and Demonstration of a Current-Stiff, Isolated Capacitive Bridge Transformer](http://arxiv.org/abs/2611.14416v1)
- **Authors**: Patrick Nowakowski, Cameron Little, Mahima Gupta
- **Published Date**: 2026-11-10T17:57:10Z
- **arXiv Link**: http://arxiv.org/abs/2611.14416v1
- **Abstract & Key Insights**:
  > The traditional Voltage Source Inverter (VSI) based Dual Active Bridge (DAB) utilizes a transformer at its center to provide galvanic isolation and a turns ratio for step up/down functionality. However, the transformer is often the limiting factor of the DAB, especially as semiconductor switching speeds improve, given steel core losses, winding losses, etc. This paper presents a new DAB architecture based on Current Source Inverters (CSIs) coupled through, and isolated by, an AC capacitive bridge, yielding a system called a Capacitive Bridge Transformer (CBT). The CBT architecture eliminates all magnetic components in the AC portion of the isolated DAB circuit, reducing frequency scaling barriers normally present in DABs. The paper introduces the CBT from the perspective of duality and then develops the DC-DC power flow equations, the internal apparent power equations, and effective turns ratio. The analytical models are verified by steady state and detailed time domain measurements on a 2 kW experimental prototype.

---
#### 30. [SIGMO: Sigmoid Gated Interaction-Aware Motion Planning](http://arxiv.org/abs/2611.14414v1)
- **Authors**: Avinash Singh, Manish Saroya, Fatemeh Cheraghi Pouria
- **Published Date**: 2026-11-10T17:53:57Z
- **arXiv Link**: http://arxiv.org/abs/2611.14414v1
- **Abstract & Key Insights**:
  > Despite the widespread adoption of autonomous vehicle technologies, reliable navigation within cluttered environments remains arduous due to the necessity of interaction-aware strategies; example scenarios include: narrow passages with multiple agents, lane changing in dense traffic, and crossing unsignalized intersections. These scenarios often require highly proactive strategies, simultaneously demanding interpretability and quick adaptability, which challenge end-to-end and data-driven methods. An effective strategy requires: scalability to multiple agents, adaptability to changes in other agents' behavior, and harmony with surrounding traffic without freezing or becoming overly conservative. To meet these requirements, we present SIGMO, a sigmoid-gated interaction-aware motion planner, with two main contributions. First, we formulate polynomial sigmoid functions that analytically estimate yield scores of surrounding agents using physics-grounded interaction features that capture driving intuitions. Second, we integrate the polynomial sigmoid functions into a receding-horizon planner, which facilitates interaction-aware planning with arbitrary trajectory predictions. We validate SIGMO in interaction-intensive simulations and hardware experiments. The results show that SIGMO balances proactive and defensive behavior while remaining computationally lightweight, serving as a strong baseline in a mobility stack. The simulation and hardware experiment videos are available here: https://sites.google.com/view/sigmoid-polygate.

---

### Codebase Integration Status
- **Integrated Module**: [`src/orchestration/multiagent-consensus.ts`](file:///Users/user/code/Cletus/src/orchestration/multiagent-consensus.ts)
- **Feature 1**: ReTrace fast-path execution graph caching (`multiagent_traces` SQLite table).
- **Feature 2**: Re-Search two-player generator/auditor ideation game (`runTwoPlayerIdeationGame()`).
- **Feature 3**: Dynamic Swarm Load Balancing across 12 specialized model tiers.
- **Entelechy Provenance**: Retained directly into Entelechy bank `'cletus'`.
