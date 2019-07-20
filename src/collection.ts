import {
  observable,
  runInAction,
  IObservableValue,
  IObservableArray,
  onBecomeObserved,
  onBecomeUnobserved
} from "mobx";
import { firestore } from "firebase";
import { Document } from "./document";

interface Options {
  query?: ((ref: firestore.CollectionReference) => firestore.Query) | undefined;
  snapshotOptions?: firestore.SnapshotOptions;
  debug?: boolean;
}

type QueryFunction = (ref: firestore.CollectionReference) => firestore.Query;

export class ObservableCollection<T extends object> {
  @observable private docsObservable: IObservableArray<Document<T>>;
  @observable private isLoadingObservable: IObservableValue<boolean>;

  private _ref: firestore.CollectionReference;
  private _query?: firestore.Query;
  private _path?: string;
  private isDebugEnabled = false;
  private readyPromise?: Promise<void>;
  private readyResolveFn?: () => void;
  private onSnapshotUnsubscribeFn?: () => void;
  private options: Options = {};

  public constructor(
    ref: firestore.CollectionReference,
    queryFn?: QueryFunction,
    options?: Options
  ) {
    this._ref = ref;
    this._path = ref.path;

    if (queryFn) {
      this._query = queryFn(ref);
    }

    if (options) {
      this.options = options;
      this.isDebugEnabled = options.debug || false;
    }

    this.docsObservable = observable.array([]);
    this.isLoadingObservable = observable.box(false);

    if (ref) {
      runInAction(() => this.updateListeners(true));
    }

    onBecomeObserved(this, "docsObservable", this.resumeUpdates);
    onBecomeUnobserved(this, "docsObservable", this.suspendUpdates);
  }

  public get docs() {
    return this.docsObservable;
  }

  public get hasDocs() {
    return this.docsObservable.length > 0;
  }

  public get isLoading() {
    return this.isLoadingObservable.get();
  }

  public get path() {
    return this._path;
  }

  public get ref() {
    return this._ref;
  }

  public get query() {
    return this._query;
  }

  public async add(data: T) {
    return this._ref.add(data);
  }

  public ready(): Promise<void> {
    this.readyPromise = this.readyPromise || Promise.resolve();
    return this.readyPromise;
  }

  private resumeUpdates = () => {
    this.logDebug("Resume updates");

    runInAction(() => this.updateListeners(true));
  };

  private suspendUpdates = () => {
    this.logDebug("Suspend updates");

    runInAction(() => this.updateListeners(false));
  };

  private changeReady(isReady: boolean) {
    if (isReady) {
      const readyResolve = this.readyResolveFn;
      if (readyResolve) {
        this.readyResolveFn = undefined;
        readyResolve();
      }
    } else if (!this.readyResolveFn) {
      this.readyPromise = new Promise(resolve => {
        this.readyResolveFn = resolve;
      });
    }
  }

  private handleSnapshot(snapshot: firestore.QuerySnapshot) {
    this.logDebug("handleSnapshot");

    runInAction(() => {
      this.docsObservable.replace(
        snapshot.docs.map(doc => ({
          id: doc.id,
          ref: doc.ref,
          data: doc.data(this.options.snapshotOptions) as T
        }))
      );

      this.isLoadingObservable.set(false);
      this.changeReady(true);
    });
  }

  private onSnapshotError(err: Error) {
    throw new Error(`${this.path} onSnapshotError: ${err.message}`);
  }

  private unsubscribeListeners() {
    this.logDebug("Unsubscribe listeners");
    this.onSnapshotUnsubscribeFn && this.onSnapshotUnsubscribeFn();
    this.onSnapshotUnsubscribeFn = undefined;
  }

  private logDebug(message: string) {
    if (this.isDebugEnabled) {
      console.log(`${message} (${this.path})`);
    }
  }

  private updateListeners(shouldListen: boolean) {
    if (!this._query) {
      return;
    }

    const wasListening = !!this.onSnapshotUnsubscribeFn;

    if (!shouldListen && wasListening) {
      this.logDebug("Stop listening");
      this.unsubscribeListeners();
    } else if (shouldListen && !wasListening) {
      this.logDebug("Start listening");
      this.changeReady(false);
      this.isLoadingObservable.set(true);

      this.onSnapshotUnsubscribeFn = this._query.onSnapshot(
        snapshot => this.handleSnapshot(snapshot),
        err => this.onSnapshotError(err)
      );
    }
  }

  public setQuery(queryFn?: QueryFunction) {
    this.logDebug("Set query");

    const query = queryFn ? queryFn(this._ref) : undefined;
    const hasQuery = !!query;
    const wasListening = !!this.onSnapshotUnsubscribeFn;

    this._query = query;

    if (wasListening) {
      this.unsubscribeListeners();
    }

    if (!hasQuery) {
      this.docsObservable.replace([]);
      this.isLoadingObservable.set(false);
      this.changeReady(true);
    } else {
      this.isLoadingObservable.set(true);
      this.changeReady(false);
      this.updateListeners(true);
    }
  }
}
