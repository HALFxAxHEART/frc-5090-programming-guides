# 10. Flywheels and Shooters

> **For:** whoever owns the shooter this season. **Read first:** [05 Motors in Phoenix 6](05-motors-in-phoenix-6.md),
> [06 Current limits](06-current-limits-and-brownouts.md), [07 What is PID](07-what-is-pid.md) and
> [08 Tuning step by step](08-tuning-pid-step-by-step.md). **Time:** about 75 minutes to read; tuning a real shooter
> takes a couple of sessions plus a shot-data session on a field.

## What you'll learn

- How to configure a flywheel in Phoenix 6: coast mode, `VelocityVoltage` in RPS, current limits, an opposed
  follower.
- Why **kV** does almost all the work on a flywheel, how to estimate it (about 0.12 for a Kraken) and measure it,
  and what kS, kP and kA add. Why we don't use kI.
- How flywheel weight (inertia) trades spin-up time against speed drop per shot, and what removing our brass
  flywheels changed.
- How to decide the shooter is **ready**, and how our debounced ready check and feeder keep the balls flowing.
- How to turn distance into shooter speed and hood angle: our 3/20 polynomial fit, and an
  `InterpolatingDoubleTreeMap` for passes, plus how to collect the shot data.
- A clean example `Flywheel` subsystem and a full tuning walk-through.

---

## The idea

### What a flywheel shooter is

A **flywheel** is a heavy-ish wheel spinning fast. A game piece is pushed into it, squeezed against a hood or a
second wheel, and flung out. On our 2026 robot (Theseus):

```
             hood (angle sets the arc)
            ______
           /      \      <- ball leaves here
   feed -> ( (O)  )      (O) = flywheel, 2 Krakens on one shaft:
   belts    \____/            leader CAN 27, follower CAN 15 (Opposed)
```

Three parts work together: the **flywheel** (speed), the **hood** (angle), and the **feeder** (only pushes a ball in
when the other two are ready). The turret aims, but that's [13 Turrets](13-turrets.md).

![Theseus, our 2026 robot, in CAD (from the robot docs site). The shooter with its flywheels and hood sits on top, on the turret; the purple sphere is a game piece, for scale.](images/cad-theseus-2026.png "60")

### Configuration basics

| Setting | Value | Why |
|---|---|---|
| NeutralMode | **Coast** | When we stop, the wheel spins down by itself. Brake mode would stop a heavy wheel violently: current spike, belt and gear stress |
| Control request | `VelocityVoltage` in **RPS** | The motor holds a speed with feedforward + PID running inside the Talon at 1 kHz |
| Stopping | `NeutralOut` / `stopMotor()` | Never `VelocityVoltage(0)`: the PID would drive the motor *backwards* to brake it |
| Current limits | Stator ~60 A, supply ~40 A per motor | Spin-up is one of the biggest draws on the robot ([06](06-current-limits-and-brownouts.md)) |
| Follower | `new Follower(leaderId, MotorAlignmentValue.Opposed)` | Two motors facing each other on one shaft. Apply the same config (limits, coast) to the follower first |
| FOC | `.withEnableFOC(true)` | More power, smoother |

![A Kraken X60. Two of them drive our flywheel shaft (leader 27, follower 15). Its Talon FX is built in, so the velocity loop runs inside the motor (photo: WCP / CTR Electronics).](images/photo-kraken-x60.png "35")

**Units.** CTRE speaks rotations per second. People (and many FRC posts) speak RPM.

```
  RPM = RPS × 60          3000 RPM = 50 RPS          Kraken X60 free speed ≈ 6000 RPM ≈ 100 RPS
```

If the flywheel is geared (motor pulley ≠ wheel pulley), either set `Feedback.SensorToMechanismRatio` so the
Talon reports **wheel** RPS, or keep motor RPS and convert. Pick one and write it in the constant's name
(`kTargetMotorRps` vs `kTargetWheelRps`). Ball speed depends on the wheel's **surface speed**:
`surface speed (m/s) = wheel RPS × π × wheel diameter (m)`. The ball leaves at some fraction of that, depending on
compression and the hood.

### Why kV dominates

A spinning flywheel needs a steady voltage just to stay at speed (to fight friction, air and the motor's own
back-EMF). That voltage is almost exactly proportional to speed. That's what **kV** is: **volts per RPS**.

```
  volts the Talon applies = kS·sign(v) + kV·target + kA·accel + kP·error
                            \_ friction  \_ the big one  \_ optional  \_ fixes what's left
```

Estimate it before you ever turn the wheel:

```
  kV ≈ 12 V / free speed in RPS
  Kraken X60:  12 / ~100 RPS ≈ 0.12        (with FOC the free speed is a bit lower, so a bit higher)
```

Real flywheels come out a little higher than that, because belts, bearings, air and the second motor all add load.
Our Shooter runs **kV 0.145**. That's normal.

With a good kV, the wheel lands within a few RPS of target with **no PID at all**. Everything else is fine-tuning.

| Gain | Units (VelocityVoltage) | What it does on a flywheel | Typical |
|---|---|---|---|
| **kV** | V per RPS | Holds the speed. The main gain | 0.12–0.16 for a Kraken |
| **kS** | V | Overcomes static friction. Small on a flywheel | 0–0.25 |
| **kP** | V per RPS of error | **Recovery**: a ball steals speed, kP pushes back hard | 0.1–1.0 |
| **kA** | V per RPS/s | Only matters if you ramp the target with `.withAcceleration()` | Usually 0 |
| **kI** | | Don't (see below) | 0 |
| **kD** | V per RPS/s of error | Almost never needed on a flywheel | 0 |

**Why not kI?** Integral adds up error over time. During a spin-up the error is huge for half a second, so the
integral winds up, and then the wheel overshoots well past the target and takes ages to settle. Every ball causes a
drop, so it winds up again. A good kV already removes steady-state error, which is the only thing kI would fix.
(Our 2024 robot Thunderstrike used a tiny kI on REV controllers. With CTRE feedforward we don't need it.)

**kP is about recovery.** When a ball goes through, the wheel slows down. The error is, say, 5 RPS. With kP 0.8
the Talon adds 4 V on top of kV's voltage until the speed comes back. Higher kP = faster recovery, until it starts
to oscillate (speed bouncing above and below target) or slams the current limit.

### Inertia: spin-up time vs speed drop

How heavy the flywheel is (technically its **moment of inertia**) is a trade-off:

| | **Heavy flywheel** (more inertia) | **Light flywheel** |
|---|---|---|
| Spin-up from zero | Slower | Faster |
| Speed lost per ball | **Smaller** (lots of stored energy) | Bigger |
| Shot-to-shot consistency when firing fast | Better | Worse, unless kP recovers fast |
| Current during spin-up | Longer at the limit | Shorter |

In 2026 we **removed two brass flywheel weights**. The shooter got up to speed faster, but each ball now pulls the
speed down further. That's why our ready check got a debouncer (below): otherwise every ball dropped the wheel out
of tolerance and the feeder stuttered between balls.

Two ways to make spin-up time not matter: spin the shooter up **before** you need it (our autos use a `SpinUp`
named command while crossing the bump), and keep it spinning while the robot is still driving into range.

### The "ready" check

Never feed a ball until the shooter is at speed. "At speed" means within a **tolerance** of the target:

```java
// Shooter.java: 5% of target, but never less than a fixed range
public double getReadyTolerance(double range) {
    return Math.max(range, Math.abs(setpoint) * kReadyPercent);
}
```

A **percentage** makes sense because a fast shot (a 60 RPS pass) naturally has more wobble than a slow one (25 RPS
close shot). The minimum (1.5 RPS) stops the tolerance getting silly-small at low speeds.

Then the **debouncer**. A WPILib `Debouncer` with `DebounceType.kFalling` turns *true* instantly but only turns
*false* after the input has been false for a set time:

```
  raw "at speed":   ‾‾‾‾‾‾‾|__|‾‾‾‾‾|___|‾‾‾‾‾      (each dip = a ball going through)
  debounced 0.15s:  ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾      (keeps feeding through short dips)
```

Short dips from a ball going through are ignored, so the feed doesn't stop and start between balls. A real problem
(the wheel can't get back up) lasts longer than 0.15 s, and feeding stops.

![What a three-ball burst looks like: the flywheel spins up into the gold ready band, each ball pulls it out of the band for a moment, and kP brings it back. The raw "at speed" signal drops with every ball, but each dip is shorter than 0.15 s, so the debounced "ready to feed" stays true. Simulated with example gains kV 0.145 and kP 0.8; your real dips will differ.](images/diagram-10-flywheel-speed-vs-time.svg)

### A feeder that waits

Our feeder command, `theYappy`, does two things:

1. **Prime:** for the first 0.2 s, run the feed path **backwards**. This pulls balls already sitting in the tunnel
   down and away from the flywheel, so the whole column starts moving together, and no ball is touching the
   flywheel while it spins up.
2. **Feed only while ready:** after that, feed when the ready check is true, stop when it's false.

It runs in a parallel group with the shooter and the hood, so all three start together when the driver holds the
trigger.

### Distance → speed (and hood angle)

The further away the target, the faster (and/or higher) you need to shoot. You can't calculate this perfectly from
physics (ball spin, compression, drag), so teams **measure** it and fit a model. Two common ways:

**1. A fitted equation.** Shoot from several distances, find the speed that scores at each, and fit a curve
(spreadsheet trendline). Our hub shot, fit on 3/20/2026:

```
  shooter RPS = 25 + 0.697·d + 0.243·d²         (d = meters to the hub's front tag)
  hood        = 1 − 0.463·d   for d ≥ 2.2 m, clamped to the hood's safe range
```

| d (m) | Shooter (RPS) | Hood (motor rot) |
|---|---|---|
| 2 | 27.4 | −0.13 (stowed, clamped) |
| 3 | 29.3 | −0.39 |
| 4 | 31.7 | −0.85 |
| 6 | 37.9 | −1.78 |

Smooth, works between your data points, and it's easy to bump the whole curve (the `25` was `20.9` before a retune).
Risky to use past your last data point: a quadratic can run away.

**2. A lookup table: `InterpolatingDoubleTreeMap`.** Put in (distance, value) pairs; ask for any distance and it
draws a straight line between the two nearest points. Outside the table it returns the end value (it doesn't
extrapolate). We use it for passes:

```java
InterpolatingDoubleTreeMap passRpsByDistance = new InterpolatingDoubleTreeMap();
passRpsByDistance.put(8.27, 45.0);    // half field
passRpsByDistance.put(16.54, 60.0);   // full field
double rps = passRpsByDistance.get(12.0);   // 51.8, halfway-ish between
```

A table is easier to fix one spot at a time ("long shots fall short, add 2 RPS at 5 m"); an equation is smoother.
Either works. Use more points where the shot is sensitive.

![Both of our distance models on one plot, computed from the code. Blue: the 3/20 hub equation (dots are the table above), which keeps curving up past the data. Black: the two-point pass table, a straight line between its points and flat outside them, because InterpolatingDoubleTreeMap doesn't extrapolate.](images/diagram-10-distance-to-shooter-rps.svg)

**The hood is part of the shooter.** Speed and angle both change the arc. Two-variable tuning is confusing, so
pick a rule: either fix the hood and tune speed per distance, or (what we did) give the hood a simple straight-line
rule and tune speed on top. And a shot isn't ready until the hood is in place too: our `readyToShoot()` checks
`hood.atSetpoint()` as well as the shooter.

---

## Step by step: tune a flywheel

Robot on blocks or the shooter clear of people. Safety glasses. Nothing in the feed path for steps 1–5.

1. **Config check.** Coast, current limits on both motors, follower Opposed and configured, `.withEnableFOC(true)`.
   Spin by hand while disabled and check the dashboard velocity goes positive when the wheel turns the shooting way.
   If not, flip `Inverted` on the **leader**.
2. **Measure kV and kS with plain voltage.** Temporarily bind three buttons to `VoltageOut` at 3 V, 6 V and 9 V.
   Hold each until the speed stops changing, write down the RPS:

   | Volts | Steady RPS |
   |---|---|
   | 3 | e.g. 19.0 |
   | 6 | e.g. 39.5 |
   | 9 | e.g. 60.0 |

   `kV = (9 − 3) / (60.0 − 19.0) = 0.146`. `kS = 3 − kV × 19.0 = 0.22`. (If kS comes out negative or tiny, use 0.)
3. **Feedforward only.** Put those in slot 0 with kP = 0. Command 30, 45, 60 RPS with `VelocityVoltage`. Each
   should land within about 1–2 RPS. If they're all low, raise kV a little; all high, lower it.
4. **kP for recovery.** Set kP = 0.1. Command your typical shot speed. Now simulate a ball: briefly press a gloved
   hand or a wooden block lightly against the wheel (or better, feed real balls in step 6). Watch speed on the
   Tuner X plot. Double kP until the dip recovers quickly. Back off if speed overshoots and rings, or if stator current
   sits on the limit for a long time. Our Shooter ended at kP 0.8.
5. **Spin-up time.** Command target from zero, time how long until "ready" goes true. If it's too slow: check the
   stator limit isn't the bottleneck (current flat at the limit the whole time), spin up earlier, or use less
   inertia.
6. **Real balls.** Feed 5 balls quickly. Watch `Ready/1 Shooter error RPS` and the feeder state. If feeding stutters
   between balls, raise kP or the debounce time a little. If balls go out at visibly different speeds, the wheel isn't
   recovering in time: more kP, more inertia, or feed slower.
7. **Ready tolerance.** Tighten it until shots are consistent but feeding still flows. 5% / 1.5 RPS is our start.
8. **Copy the numbers into `Constants`** with the date and what they were tuned on.

## Step by step: build a distance table

1. **Get good distance first.** The robot's pose has to be right (AprilTags working, see
   [17 Limelight](17-limelight-and-vision.md)). Check by putting the robot at a measured spot and reading the
   distance on the dashboard.
2. **Mark distances on the floor** with tape: e.g. every 0.5 m across the range you'll shoot from.
3. At each mark: adjust speed (and hood, if it's in your model) with bump buttons until about 4 of 5 shots score.
   Note the middle of the range that works, not the edge.
4. **Use the shot log.** Every shot writes one line to the log with distance, shooter actual/target, hood
   actual/target, turret error and robot speed. Copy those lines into a spreadsheet instead of writing by hand.
5. **Fit or table it.** Scatter plot speed vs distance, add a 2nd-order polynomial trendline (shows the equation),
   or put the points straight into an `InterpolatingDoubleTreeMap`.
6. **Check in between.** Shoot from distances *between* your marks. If those miss, add points there.
7. **Write the date** next to the equation, like `/** New Equation 3/20/26 */`. When the robot changes (new wheels,
   flywheel weights removed), the data is stale. Retake it.

---

## Example: a clean Flywheel subsystem

New code for a two-Kraken flywheel, with professional names and everything above built in.

Constants:

```java
public static final class FlywheelConstants {
    public static final int kLeaderMotorId = 27;
    public static final int kFollowerMotorId = 15;
    /** Stator: fast spin-up and recovery, capped torque spike */
    public static final double kStatorCurrentLimitAmps = 60;
    /** Supply: battery draw per motor, so spin-up while driving doesn't brown out */
    public static final double kSupplyCurrentLimitAmps = 40;
    /** Feedforward/PID, VelocityVoltage, motor RPS. kV measured with the 3/6/9 V test. */
    public static final double kS = 0.2;     // volts
    public static final double kV = 0.145;   // volts per RPS
    public static final double kA = 0.0;     // volts per RPS/s
    public static final double kP = 0.8;     // volts per RPS of error
    /** At speed if within this fraction of the target... */
    public static final double kReadyTolerancePercent = 0.05;
    /** ...or this many RPS, whichever is bigger */
    public static final double kMinReadyToleranceRps = 1.5;
    /** Stay "ready" this long after a dip, so feeding doesn't stutter between balls */
    public static final double kReadyHoldSeconds = 0.15;
}
```

Subsystem:

```java
package frc.robot.subsystems;

import static frc.robot.Constants.FlywheelConstants.*;

import java.util.function.DoubleSupplier;

import com.ctre.phoenix6.BaseStatusSignal;
import com.ctre.phoenix6.CANBus;
import com.ctre.phoenix6.StatusCode;
import com.ctre.phoenix6.StatusSignal;
import com.ctre.phoenix6.configs.TalonFXConfiguration;
import com.ctre.phoenix6.controls.Follower;
import com.ctre.phoenix6.controls.NeutralOut;
import com.ctre.phoenix6.controls.VelocityVoltage;
import com.ctre.phoenix6.hardware.TalonFX;
import com.ctre.phoenix6.signals.InvertedValue;
import com.ctre.phoenix6.signals.MotorAlignmentValue;
import com.ctre.phoenix6.signals.NeutralModeValue;

import edu.wpi.first.math.filter.Debouncer;
import edu.wpi.first.math.filter.Debouncer.DebounceType;
import edu.wpi.first.units.measure.AngularVelocity;
import edu.wpi.first.units.measure.Current;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

/** Two Kraken X60s on one flywheel shaft. Leader is commanded, follower is mounted facing it (Opposed). */
public class Flywheel extends SubsystemBase {
    private final TalonFX m_leaderMotor;
    private final TalonFX m_followerMotor;

    private final VelocityVoltage m_velocityRequest = new VelocityVoltage(0).withSlot(0).withEnableFOC(true);
    private final NeutralOut m_neutralRequest = new NeutralOut();

    private final StatusSignal<AngularVelocity> m_velocitySignal;
    private final StatusSignal<Current> m_statorCurrentSignal;

    private final Debouncer m_readyDebouncer = new Debouncer(kReadyHoldSeconds, DebounceType.kFalling);

    private double m_targetRps = 0.0;
    private boolean m_atSpeed = false;
    private boolean m_readyToFeed = false;

    public Flywheel(CANBus canBus) {
        m_leaderMotor = new TalonFX(kLeaderMotorId, canBus);
        m_followerMotor = new TalonFX(kFollowerMotorId, canBus);

        TalonFXConfiguration config = new TalonFXConfiguration();
        config.MotorOutput.NeutralMode = NeutralModeValue.Coast;               // spin down on its own
        config.MotorOutput.Inverted = InvertedValue.CounterClockwise_Positive; // positive = shoots out (checked)
        config.CurrentLimits.StatorCurrentLimit = kStatorCurrentLimitAmps;
        config.CurrentLimits.StatorCurrentLimitEnable = true;
        config.CurrentLimits.SupplyCurrentLimit = kSupplyCurrentLimitAmps;
        config.CurrentLimits.SupplyCurrentLimitEnable = true;
        config.Slot0.kS = kS;
        config.Slot0.kV = kV;
        config.Slot0.kA = kA;
        config.Slot0.kP = kP;

        // One full config per motor, applied once. The follower needs it too: followers copy the leader's
        // output, not its current limits or neutral mode.
        reportIfFailed(m_leaderMotor.getConfigurator().apply(config), "leader");
        reportIfFailed(m_followerMotor.getConfigurator().apply(config), "follower");
        m_followerMotor.setControl(new Follower(kLeaderMotorId, MotorAlignmentValue.Opposed));

        m_velocitySignal = m_leaderMotor.getVelocity();
        m_statorCurrentSignal = m_leaderMotor.getStatorCurrent();
    }

    /** Spin the flywheel at this speed, in motor rotations per second. 0 or less coasts it to a stop. */
    public void setTargetRps(double targetRps) {
        if (targetRps <= 0) {
            stop();
            return;
        }
        m_targetRps = targetRps;
        m_leaderMotor.setControl(m_velocityRequest.withVelocity(targetRps));
    }

    /** Let the flywheel coast down. Never command 0 RPS closed-loop: that brakes it with reverse voltage. */
    public void stop() {
        m_targetRps = 0.0;
        m_leaderMotor.setControl(m_neutralRequest);
    }

    public double getVelocityRps() {
        return m_velocitySignal.getValueAsDouble();
    }

    public double getTargetRps() {
        return m_targetRps;
    }

    /** @return allowed speed error, in RPS: a percentage of the target, with a minimum */
    public double getReadyToleranceRps() {
        return Math.max(kMinReadyToleranceRps, m_targetRps * kReadyTolerancePercent);
    }

    /** @return true right now if the speed is within tolerance (drops briefly as each ball goes through) */
    public boolean isAtSpeed() {
        return m_atSpeed;
    }

    /** @return true when it's OK to feed: at speed, ignoring dips shorter than kReadyHoldSeconds */
    public boolean isReadyToFeed() {
        return m_readyToFeed;
    }

    /** Runs the flywheel while scheduled, following a speed that can change (e.g. with distance), then coasts. */
    public Command runAtSpeedCommand(DoubleSupplier targetRps) {
        return runEnd(() -> setTargetRps(targetRps.getAsDouble()), this::stop).withName("Flywheel run");
    }

    @Override
    public void periodic() {
        BaseStatusSignal.refreshAll(m_velocitySignal, m_statorCurrentSignal);

        m_atSpeed = m_targetRps > 0
            && Math.abs(getVelocityRps() - m_targetRps) <= getReadyToleranceRps();
        // Update the debouncer every loop (not only when someone asks), so its timing is right
        m_readyToFeed = m_readyDebouncer.calculate(m_atSpeed);

        SmartDashboard.putNumber("Flywheel/Target (RPS)", m_targetRps);
        SmartDashboard.putNumber("Flywheel/Velocity (RPS)", getVelocityRps());
        SmartDashboard.putNumber("Flywheel/Error (RPS)", m_targetRps - getVelocityRps());
        SmartDashboard.putNumber("Flywheel/Stator current (A)", m_statorCurrentSignal.getValueAsDouble());
        SmartDashboard.putBoolean("Flywheel/At speed", m_atSpeed);
        SmartDashboard.putBoolean("Flywheel/Ready to feed", m_readyToFeed);
    }

    private static void reportIfFailed(StatusCode status, String motorName) {
        if (!status.isOK()) {
            DriverStation.reportError("Flywheel " + motorName + " config failed: " + status.getDescription(), false);
        }
    }
}
```

And the shoot command in `RobotContainer`, feeding only when ready. `Feeder`, `hood.followAngleCommand`,
`hood.isAtTarget`, `ShotModel` and `distanceToHubMeters()` are placeholder names for the pieces you'd write (the
feeder follows `theYappy`'s logic below; the shot model is our 3/20 equations moved into their own class):

```java
public Command shootAtHubCommand() {
    return Commands.parallel(
        flywheel.runAtSpeedCommand(() -> ShotModel.hubShooterRps(distanceToHubMeters())),
        hood.followAngleCommand(() -> ShotModel.hubHoodRotations(distanceToHubMeters())),
        feeder.feedWhenReadyCommand(() -> flywheel.isReadyToFeed() && hood.isAtTarget())
    ).withName("Shoot at hub");
}
```

---

## In our code

### Shooter config and the double apply

[Shooter.java, lines 32–70 (config, the overwriting Slot0, follower)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/subsystems/Shooter.java#L32-L70)

```java
shooterConfig.MotorOutput.NeutralMode = NeutralModeValue.Coast; // Coast is safer for heavy flywheels
...
shooterConfig.Slot0.kP = 0.4;
shooterConfig.Slot0.kD = 0.0005;
shooterConfig.Slot0.kV = 0.16;
leadShoot.getConfigurator().apply(shooterConfig);

Slot0Configs shooterPID = new Slot0Configs();
shooterPID.kP = .8; // Changed to 2.0 for smoother recovery
shooterPID.kD = 0; //.0005
shooterPID.kV = 0.145; // .16
leadShoot.getConfigurator().apply(shooterPID);
...
followShoot.setControl(new Follower(27, MotorAlignmentValue.Opposed));
```

Notice: coast, current limits on both motors, follower Opposed. Then the lesson: **the second apply replaces all of
slot 0**, so the flywheel really runs kP 0.8, kD 0, kV 0.145, and the first set is dead. (The comment "Changed to
2.0" is also stale.) The real gains are reasonable: kV close to the 0.12 estimate, kP for recovery, no kI. Fix it by
keeping one slot 0, in Constants.

### Ready tolerance

[Shooter.java, lines 84–103 (kReadyPercent, getReadyTolerance, isShooterReady)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/subsystems/Shooter.java#L84-L103).
Not ready when the target is 0 (not shooting); otherwise within 5% or the given range, whichever is bigger.

### Debounced readiness

[RobotContainer.java, lines 100–102 (the 0.15 s falling Debouncer)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L100-L102)
and [lines 310–317 (readyToShoot)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L310-L317)

```java
// Each ball pulls the flywheel down, and with 2 brass flywheels removed it drops further.
// Keep feeding for a moment after "ready" goes false so the rollers don't stutter between balls.
private final Debouncer m_readyDebouncer = new Debouncer(0.15, DebounceType.kFalling);
...
public boolean readyToShoot() {
    return m_readyDebouncer.calculate(
        shooter.isShooterReady(1.5) &&
        hood.atSetpoint());
}
```

Notice the turret is deliberately *not* in the ready check (it's always tracking), but the hood is. One thing to
improve: `calculate()` only runs when someone calls `readyToShoot()`, i.e. while the feeder is running. The example
above updates its debouncer in `periodic()` every loop instead, which keeps the timing honest.

### The feeder: prime, then feed while ready

[theYappy.java, lines 14–16 and 42–61 (prime backwards 0.2 s, then feed only while ready)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/commands/theYappy.java#L42-L61)

```java
if (timer.get() < kPrimeReverseSeconds) {
    rollers.roll(RollerSystem.kUnjamSpeedRPS);
    SmartDashboard.putString("Feeder/State", "Priming (backwards)");
}
else if (runCondition.getAsBoolean()) {
    if (!wasFeeding) {
        onFeedStart.run();
    }
    wasFeeding = true;
    rollers.roll(RollerSystem.kFeedSpeedRPS);
    SmartDashboard.putString("Feeder/State", "FEEDING");
}
else{
    wasFeeding = false;
    rollers.rollerStop();
    SmartDashboard.putString("Feeder/State", "Waiting for Ready (see Ready/ lights)");
}
```

Notice the ready condition is passed in as a `BooleanSupplier`, so the same command works for the full shot, the
auto shot (which also refuses to feed while passing) and the fixed failsafe shot. The `onFeedStart` hook writes the
shot log line. `Feeder/State` on the dashboard tells you exactly what it's doing. The class name is a joke;
`FeedWhenReady` says what it does.

### All three together

[RobotContainer.java, lines 189–198 (fullShootCommand: shooter + feeder + hood in parallel)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L189-L198).
The shooter takes a `DoubleSupplier`, so its speed is recalculated every loop as the distance changes (that's what
makes shooting on the move possible).

### Distance models

[RobotContainer.java, lines 252–276 (hubShooterRPS and hubHoodAngle, fit 3/20/26)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L252-L276)

```java
/** New Equation 3/20/26 (For Hub Shooting) */
private double hubShooterRPS(double targetDist) {
    return (25 + 0.697 * targetDist + 0.243 * Math.pow(targetDist, 2)); //20.9 -> 25
}
...
private double hubHoodAngle(double targetDist) {
    double optimal = 0;
    if (targetDist >= 2.2) {
        optimal = (1 - (0.463 * targetDist));
    }
    return clampHood(optimal);
}
```

And [lines 89–91 and 109–113 (pass maps)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L109-L113):
two points each, so it's a straight line from 45 RPS at 8.27 m to 60 RPS at 16.54 m, hood fixed at −2.2.

Important detail: the formulas were fit using distance to the hub's **front tag**, but the turret aims at the hub
**center**, so `Turret` subtracts 0.604 m before handing the distance over
([Turret.java, lines 45–48](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/subsystems/Turret.java#L45-L48)).
If you change what "distance" means, the fit is wrong. Write down how distance was measured next to any fit.

### The shot log

[RobotContainer.java, lines 319–335 (logShot)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/RobotContainer.java#L319-L335)

```java
RobotLog.event(String.format(
    "SHOT #%d %s %s | dist %.2fm | shooter %.1f/%.1f RPS | hood %.2f/%.2f | turret err %.2f rot | speed %.2f m/s | pose (%.2f, %.2f, %.0f deg)",
    m_shotCount, kind, turret.isPassing() ? "PASS" : "HUB", turret.getShootingDistance(),
    shooter.getVelocityRPS(), shooter.getTargetRPS(), hood.getAngle(), hood.getSetpoint(),
    turret.getAimErrorMotorRotations(), speed,
    state.Pose.getX(), state.Pose.getY(), state.Pose.getRotation().getDegrees()));
```

One line per shot with everything you need to explain a miss or to build a table. Pair it with match video (or a
note of hit/miss per shot) and you have shot data from every practice.

### The hood

[Hood.java, lines 50–67 (PositionVoltage hood: brake, limits, soft limits)](https://github.com/TorqueNados-FRC5090/Hephaestus/blob/c2f0cee6f61db3f26f911d3f5623ed7fa27a5b03/src/main/java/frc/robot/subsystems/Hood.java#L50-L67).
Brake mode, soft limits (still placeholders), and it's forced down near a trench, where a raised hood breaks. Since
`atSetpoint()` is false while forced down, the feeder automatically waits.

---

## Common mistakes

- **Two applies to slot 0.** The Shooter's second `Slot0Configs` replaced the first. Tune in one place.
- **Brake mode on the flywheel.** Violent stops, current spikes, broken belts. Coast.
- **Stopping with `VelocityVoltage(0)`.** The PID drives the motor backwards to brake. Use `NeutralOut` /
  `stopMotor()`.
- **RPM into a RPS request.** 3000 "RPS" just pins the motor at full power. Divide by 60.
- **Tuning kP before kV.** Pure kP never reaches the target (our feed rollers proved it: "with only kP the rollers
  never reached their target speed"). kV first.
- **Adding kI to "fix" a speed that's a bit low.** Raise kV instead.
- **No debounce on ready.** After the brass came off, every ball dropped the wheel out of tolerance and the feeder
  stuttered.
- **Different tolerances in different places.** The dashboard's `Shooter/Ready` uses a 2 RPS range, the real shot
  check uses 1.5. When they disagree, people trust the wrong light. Use one constant.
- **Stale shot data.** Wheels wear, weights get removed, compression changes. Retake data after any shooter change,
  and date your fits.
- **Changing how distance is measured** (tag vs hub center) without refitting.
- **Not spinning up early.** Spin-up time is wasted match time. Spin up on the way.

## Checklist

- [ ] Coast mode, current limits on leader **and** follower, follower `Opposed` if the motors face each other.
- [ ] Positive = shooting direction, checked by hand.
- [ ] kV measured (3/6/9 V test), kS small, kP tuned for recovery, kI = 0.
- [ ] Gains live in one place (Constants), applied once.
- [ ] Ready = percent tolerance with a minimum, debounced on the falling edge.
- [ ] Feeder waits for shooter **and** hood; dashboard shows what it's waiting on.
- [ ] Distance model dated, with a note of how distance was measured.
- [ ] Shot log line written on every shot.
- [ ] Spin-up time measured; autos spin up before they need to shoot.

## Practice

1. **kV by hand.** A Kraken flywheel holds 39 RPS at 6 V and 19 RPS at 3 V. What are kV and kS? What voltage will it
   need for 50 RPS? (Answer: kV 0.15, kS 0.15, about 7.65 V.)
2. **Simulate the debouncer.** In a test robot project, make a `Debouncer(0.15, DebounceType.kFalling)` and feed it
   a boolean from a dashboard checkbox in `robotPeriodic()`. Tick and untick quickly; watch the output. Then try
   `kRising` and `kBoth` and explain the difference.
3. **Equation vs table.** Using `hubShooterRPS`, compute the speed at 2, 3, 4, 5 and 6 m. Put those five points into
   an `InterpolatingDoubleTreeMap` and compare its answer to the equation at 2.5 m and 7 m. Why are they different at
   7 m?
4. **Clean up the Shooter (branch only).** Rewrite `Shooter.java` with one slot 0 from Constants, requests as fields,
   `NeutralOut` to stop, and one tolerance constant used by both the dashboard and `isShooterReady`. Test in
   simulation.

## Go further

- WPILib, tuning a flywheel (interactive, explains why feedforward first): https://docs.wpilib.org/en/stable/docs/software/advanced-controls/introduction/tuning-flywheel.html
- WPILib, feedforward (kS, kV, kA): https://docs.wpilib.org/en/stable/docs/software/advanced-controls/controllers/feedforward.html
- WPILib, Debouncer: https://docs.wpilib.org/en/stable/docs/software/advanced-controls/filters/debouncer.html
- CTRE, closed-loop requests (VelocityVoltage, gains, units): https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/device-specific/talonfx/closed-loop-requests.html
- CTRE, basic PID control: https://v6.docs.ctr-electronics.com/en/stable/docs/api-reference/device-specific/talonfx/basic-pid-control.html
- ReCalc flywheel calculator (spin-up time, speed drop per shot): https://www.reca.lc/flywheel
