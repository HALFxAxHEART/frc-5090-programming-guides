# FRC 5090 Programming Guides

These guides cover what a 5090 programmer should know: setting up laptops and the robot, controlling CTRE motors,
PID and feedforward, each kind of mechanism we build, sensors, vision, autos, and debugging. Each guide points to the code we already
wrote so you can see how we did it on a real robot.

> **New to the team?** Read `STUDENT-GUIDE.md` in the Robot-Template repo first. It covers
> installing the tools, finding your way around the project, and the team rules. Then follow the learning path below.

## Learning path

| Stage | Read these | You can... |
|---|---|---|
| **1. Getting started** | [23 Set up a laptop](23-setting-up-a-programming-laptop.md), [24 Our robot template](24-using-our-robot-template.md), [25 How to research](25-how-to-research.md), [22 Git and standards](22-git-and-code-standards.md) | Have a working laptop, start a robot project, and find answers on your own |
| **2. Robot basics** | [01 Radio and network](01-radio-and-robot-network.md), [02 Tuner X and CAN](02-phoenix-tuner-x-and-can.md), [03 Driver Station](03-driver-station-and-match-checklist.md), [30 Device catalog](30-sensor-and-device-catalog.md) | Get a robot talking to a laptop, enable it safely, and know every part on it |
| **3. Writing code** | [04 Command-based](04-command-based-basics.md), [05 Motors in Phoenix 6](05-motors-in-phoenix-6.md), [06 Current limits](06-current-limits-and-brownouts.md), [31 Phoenix Pro and FOC](31-phoenix-pro-features.md) | Write a subsystem, bind it to a button, and keep the robot from browning out |
| **4. Control** | [07 What is PID](07-what-is-pid.md), [08 Tuning step by step](08-tuning-pid-step-by-step.md), [09 Motion Magic](09-motion-magic-and-position-control.md) | Make a mechanism hit a speed or a position quickly and repeatably |
| **5. Mechanisms** | [10 Flywheels](10-flywheels-and-shooters.md), [11 Intakes](11-intakes-and-rollers.md), [12 Spring-back](12-spring-back-and-auto-retract.md), [13 Turrets](13-turrets.md), [14 Arms](14-arms-single-and-double-jointed.md), [15 Elevators](15-elevators.md), [26 State machines](26-state-machines-for-pick-and-place.md) | Configure and tune whatever the build team hands you, and make several mechanisms work together |
| **6. Sensors and encoders** | [21 Sensors and homing](21-sensors-and-homing.md), [27 Relative vs absolute encoders](27-relative-vs-absolute-encoders.md), [28 Fusing sensors to a motor](28-fusing-sensors-to-a-motor.md), [29 Chinese Remainder Theorem](29-chinese-remainder-theorem-turrets.md) | Know where every mechanism is, from the moment the robot turns on |
| **7. Driving, vision and autos** | [16 Swerve](16-swerve-drive-ctre.md), [17 Limelight](17-limelight-and-vision.md), [32 Object detection](32-limelight-object-detection.md), [33 Calibrating at events](33-limelight-field-calibration-at-events.md), [18 PathPlanner](18-pathplanner-autos.md), [35 Teleop auto-align](35-teleop-auto-align-with-pathplanner.md) | Drive accurately, know where the robot and game pieces are, run autos, and line up on a button press |
| **8. Finding problems** | [19 Logging and debugging](19-logging-and-debugging.md), [20 Simulation and testing](20-simulation-and-testing.md), [34 AdvantageKit and AdvantageScope](34-advantagekit-and-advantagescope.md) | Work out why the robot did something, and test before it touches the floor |

The binder is printed in this order, and the gold tab on the page edge moves down one step for each stage.

## "I need to..."

| I need to... | Go to |
|---|---|
| Set up a new laptop | [23](23-setting-up-a-programming-laptop.md) |
| Start a new robot project | [24](24-using-our-robot-template.md) |
| Find an answer nobody on the team knows | [25](25-how-to-research.md) |
| Flash or set up the radio | [01](01-radio-and-robot-network.md) |
| Set a CAN ID or update firmware | [02](02-phoenix-tuner-x-and-can.md) |
| Know what to check before a match | [03](03-driver-station-and-match-checklist.md) |
| Identify a sensor or device and how to code it | [30](30-sensor-and-device-catalog.md) |
| Make a button do something | [04](04-command-based-basics.md) |
| Spin a motor at a speed or to a position | [05](05-motors-in-phoenix-6.md), [09](09-motion-magic-and-position-control.md) |
| Set current limits / stop brownouts | [06](06-current-limits-and-brownouts.md) |
| Know what our Phoenix Pro license gets us (FOC and more) | [31](31-phoenix-pro-features.md) |
| Understand PID | [07](07-what-is-pid.md) |
| Tune PID | [08](08-tuning-pid-step-by-step.md) |
| Set up and tune a flywheel / shooter | [10](10-flywheels-and-shooters.md) |
| Set up an intake (rollers, pivot, rack) | [11](11-intakes-and-rollers.md) |
| Make something go back in when the button is released, or give when it's hit | [12](12-spring-back-and-auto-retract.md) |
| Aim a turret | [13](13-turrets.md) |
| Control an arm (one joint or two) | [14](14-arms-single-and-double-jointed.md) |
| Control an elevator | [15](15-elevators.md) |
| Coordinate an elevator, arm and claw for a pick-and-place game | [26](26-state-machines-for-pick-and-place.md) |
| Add a limit switch / beam break / zero a mechanism | [21](21-sensors-and-homing.md) |
| Choose between the motor's encoder and a through-bore encoder | [27](27-relative-vs-absolute-encoders.md) |
| Use a CANcoder (or other sensor) as the motor's feedback | [28](28-fusing-sensors-to-a-motor.md) |
| Know a turret's angle at power-on with two encoders | [29](29-chinese-remainder-theorem-turrets.md) |
| Set up swerve | [16](16-swerve-drive-ctre.md) |
| Use a Limelight for AprilTags | [17](17-limelight-and-vision.md) |
| Find game pieces with a Limelight | [32](32-limelight-object-detection.md) |
| Check the cameras during field calibration at an event | [33](33-limelight-field-calibration-at-events.md) |
| Make an auto | [18](18-pathplanner-autos.md) |
| Hold a button and have the robot drive itself to shoot, climb, or score | [35](35-teleop-auto-align-with-pathplanner.md) |
| Find out why the robot did something weird | [19](19-logging-and-debugging.md) |
| Test without the robot | [20](20-simulation-and-testing.md) |
| Understand AdvantageKit when I see it in another team's code | [34](34-advantagekit-and-advantagescope.md) |
| Use Git without breaking things | [22](22-git-and-code-standards.md) |

## Finding our code from a guide

Every guide points at code we already wrote. On paper a code reference looks like this:

> the shooter's ready check <span class="cref">Hephaestus (2026) · subsystems/Shooter.java · lines 92–103</span>

That means: repo **Hephaestus**, file `src/main/java/frc/robot/subsystems/Shooter.java`, lines 92 to 103.
(`src/main/java/frc/robot/` is left off to save space. Files outside it, like `deploy/pathplanner/...` or
`STUDENT-GUIDE.md`, show their full path.)

To open it:

1. Open the repo in WPILib VS Code (clone it first if you don't have it; see [22 Git](22-git-and-code-standards.md)).
2. Press **Ctrl+P**, type the file name (e.g. `Shooter.java`), press Enter.
3. Press **Ctrl+G** and type the line number.

The line numbers match the code as it was when these guides were written (October 2026). If someone has changed the
file since, the lines may have moved a little. Search the file (**Ctrl+F**) for the method name in the guide instead.

Other web pages are marked with a small number, like this<sup>1</sup>. The full address is listed at the end of that
guide under **Web links in this guide**.

Scan a code to open each repo on a phone or laptop:

<!-- REPO-CARDS -->

## How each guide is laid out

Every guide follows the same pattern, so you always know where to look:

1. **What you'll learn**
2. **The idea**, explained simply
3. **Step by step**: what to do at the robot or in VS Code
4. **In our code**: where to find what we already built, and what to notice
5. **Common mistakes**: most of these really happened to us
6. **Checklist**: for doing it on a real robot
7. **Practice**: small exercises to try in simulation or on the robot
8. **Go further**: official docs
9. **Notes**: lined space at the end for your own notes

## A word about AI

Some guides have a blue **AI can help** box. AI tools are good at explaining an error, explaining code you didn't
write, or checking your math. They are also confidently wrong sometimes, and they invent methods that don't exist.
Use AI to understand and to check your work, never to skip understanding it. Everything you commit, you should be able
to explain line by line, and the robot is the final judge.

## A note on 2027

These guides are written for the 2026 software (WPILib 2026, Phoenix 6 v26, PathPlanner 2026, Limelight OS 2026).
In 2027 the **SystemCore** controller replaces the roboRIO, so some setup steps (imaging, networking, parts of the
Driver Station) will change. The control ideas (PID, feedforward, Motion Magic, current limits, command-based
structure, vision, PathPlanner) carry over. When something here disagrees with the current official docs, trust the
docs and fix the guide.
